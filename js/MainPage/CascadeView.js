// This file governs the 3D Viewport which displays the 3D Model
// It is also in charge of saving to STL and OBJ

/** Create the base class for a 3D Viewport.
 *  This includes the floor, the grid, the fog, the camera, and lights */
var Environment = function (goldenContainer) {
  this.goldenContainer = goldenContainer;

  this.initEnvironment = function () {
    // Get the current Width and Height of the Parent Element
    this.parentWidth  = this.goldenContainer.width;
    this.parentHeight = this.goldenContainer.height;

    // Create the Canvas and WebGL Renderer
    this.curCanvas = document.createElement('canvas');
    this.goldenContainer.getElement().get(0).appendChild(this.curCanvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.curCanvas, antialias: true, webgl2: false });
    this.renderer.setPixelRatio(1); this.renderer.setSize(this.parentWidth, this.parentHeight);
    this.goldenContainer.on('resize', this.onWindowResize.bind(this));

    // Create the Three.js Scene
    this.scene = new THREE.Scene();
    this.backgroundColor  = 0x222222; //0xa0a0a0
    this.scene.background = new THREE.Color(this.backgroundColor);          
    this.scene.fog        = new THREE.Fog  (this.backgroundColor, 200, 600);

    this.camera = new THREE.PerspectiveCamera (45, 1, 1, 5000);
                //new THREE.OrthographicCamera(300 / - 2, 300 / 2, 300 / 2, 300 / - 2, 1, 1000);
                // Consider an Orthographic Camera.  It doesn't look so hot with the Matcap Material.
    this.camera.position.set(50, 100, 150);
    this.camera.lookAt(0, 45, 0);
    this.camera.aspect = this.parentWidth / this.parentHeight;
    this.camera.updateProjectionMatrix();

    // Create two lights to evenly illuminate the model and cast shadows
    this.light  = new THREE.HemisphereLight (0xffffff, 0x444444);
    this.light .position.set(0, 200, 0);
    this.light2 = new THREE.DirectionalLight(0xbbbbbb);
    this.light2.position.set(6, 50, -12);
    this.light2.castShadow = true;
    this.light2.shadow.camera.top      =  200;
    this.light2.shadow.camera.bottom   = -200;
    this.light2.shadow.camera.left     = -200;
    this.light2.shadow.camera.right    =  200;
    //this.light2.shadow.radius        =  32;
    this.light2.shadow.mapSize.width   =  128;
    this.light2.shadow.mapSize.height  =  128;
    this.scene.add(this.light);
    this.scene.add(this.light2);
    this.renderer.shadowMap.enabled    = true;
    this.renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
    //this.scene.add(new THREE.CameraHelper(this.light2.shadow.camera));

    // Create the ground mesh
    this.groundMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000),
      new THREE.MeshPhongMaterial({
        color: 0x080808, depthWrite: true,
        polygonOffset: true, // Push the mesh back for line drawing
        polygonOffsetFactor: 6.0, polygonOffsetUnits: 1.0
      }));
    this.groundMesh.position.y = -0.1;
    this.groundMesh.rotation.x = - Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Create the Ground Grid; one line every 100 units
    this.grid = new THREE.GridHelper(2000, 20, 0xcccccc, 0xcccccc);
    this.grid.position.y = -0.01;
    this.grid.material.opacity = 0.3;
    this.grid.material.transparent = true;
    this.scene.add(this.grid);

    // Set up the orbit controls used for Cascade Studio
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 45, 0);
    this.controls.panSpeed  = 2;
    this.controls.zoomSpeed = 1;
    this.controls.screenSpacePanning = true;
    this.controls.update();

    // Keep track of the last time the scene was interacted with
    // This allows for lazy rendering to reduce power consumption
    this.controls.addEventListener('change', () => this.viewDirty = true);
    this.isVisible = true; this.viewDirty = true; 
    this.time = new THREE.Clock();
    this.time.autoStart = true;
    this.lastTimeRendered = 0.0;

    this.goldenContainer.layoutManager.eventHub.emit('Start');
  }

  // Draw Text to a Texture and spawn it as a Quad
  this.createLabel = (text, x, y, z, size, color) => {
    let canvas           = document.createElement("canvas");
    let context          = canvas.getContext("2d");
    context.font         = "bold 96px arial";
    context.textAlign    = "center";
    context.textBaseline = "middle";
    context.fillStyle    = color;
    context.fillText       (text, canvas.width  / 2, canvas.height / 2);
    let texture          = new THREE.Texture(canvas); texture.needsUpdate = true;
    let material         = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
    let mesh             = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 1, 1), material);
    mesh.renderOrder     = 101;
    mesh.position.set(x, y, z);
    return mesh;
  }

  // Resize the container, canvas, and renderer when the window resizes
  this.onWindowResize = function () {
      this.goldenContainer.layoutManager.updateSize(window.innerWidth, window.innerHeight -
        document.getElementsByClassName('topnav')[0].offsetHeight);
      this.camera.aspect  = this.goldenContainer.width / this.goldenContainer.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.goldenContainer.width, this.goldenContainer.height);
      this.renderer.render(this.scene, this.camera);
      this.viewDirty = true;
  }

  // Initialize the Environment!
  this.initEnvironment();
}

/** This "inherits" from Environment (by including it as a sub object) */
var CascadeEnvironment = function (goldenContainer) {
  this.goldenContainer = goldenContainer;
  this.environment     = new Environment(this.goldenContainer);

  // State for the Hover Highlighting
  this.raycaster       = new THREE.Raycaster();
  this.highlightedObj  = null;
  this.fogDist         = 200;

  // State for the Handles
  this.handles         = [];
  this.gizmoMode       = "translate";
  this.gizmoSpace      = "local";

  // Load the Shiny Dull Metal Matcap Material
  this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin ('');
  this.matcap = this.loader.load ('./textures/dullFrontLitMetal.png', (tex) => this.environment.viewDirty = true );
  this.matcapMaterial = new THREE.MeshMatcapMaterial({
                          color: new THREE.Color(0xf5f5f5),
                          matcap: this.matcap,
                          polygonOffset: true, // Push the mesh back for line drawing
                          polygonOffsetFactor: 2.0,
                          polygonOffsetUnits: 1.0
                        });
  
  // A special corner gizmo that controls the orientation of the camera
  this.viewCube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(
      { color: 0x1f1f1f, depthTest: false, depthWrite: true, transparent: true }));
  this.viewCube.renderOrder = 100;
  this.viewCube.add(this.environment.createLabel("+X",  0.5,  0.0,  0.0, 1, /*"red"  */"white").rotateY( 1.57));
  this.viewCube.add(this.environment.createLabel("-X", -0.5,  0.0,  0.0, 1, /*"red"  */"white").rotateY(-1.57));
  this.viewCube.add(this.environment.createLabel("-Y",  0.0,  0.0,  0.5, 1, /*"green"*/"white"));
  this.viewCube.add(this.environment.createLabel("+Y",  0.0,  0.0, -0.5, 1, /*"green"*/"white").rotateY( 3.14));
  this.viewCube.add(this.environment.createLabel("+Z",  0.0,  0.5,  0.0, 1, /*"blue" */"white").rotateX(-1.57));
  this.viewCube.add(this.environment.createLabel("-Z",  0.0, -0.5,  0.0, 1, /*"blue" */"white").rotateX( 1.57));
  this.environment.scene.add(this.viewCube);

  // A callback to load the Triangulated Shape from the Worker and add it to the Scene
  messageHandlers["combineAndRenderShapes"] = ([facelist, edgelist]) => {
    workerWorking = false;     // Untick this flag to allow Evaluations again
    if (!facelist) { return;}  // Do nothing if the results are null

    // The old mainObject is dead!  Long live the mainObject!
    this.environment.scene.remove(this.mainObject);
    this.mainObject            = new THREE.Group();
    this.mainObject.name       = "shape";
    this.mainObject.rotation.x = -Math.PI / 2;

    // Add Triangulated Faces to Object
    let vertices = []; let triangles = []; let vInd = 0; let globalFaceIndex = 0;
    facelist.forEach((face) => {
      // Sort Vertices into three.js Vector3 List
      for (let i = 0; i < face.vertex_coord.length; i += 3) {
        vertices.push(new THREE.Vector3(face.vertex_coord[i    ],
                                        face.vertex_coord[i + 1],
                                        face.vertex_coord[i + 2]));
      }
      // Sort Triangles into a three.js Face List
      for (let i = 0; i < face.tri_indexes.length; i += 3) {
        triangles.push(new THREE.Face3(face.tri_indexes[i] + vInd,face.tri_indexes[i + 1] + vInd, face.tri_indexes[i + 2] + vInd, 
                      [new THREE.Vector3(face.normal_coord[(face.tri_indexes[i     ] * 3)    ], 
                                         face.normal_coord[(face.tri_indexes[i     ] * 3) + 1], 
                                         face.normal_coord[(face.tri_indexes[i     ] * 3) + 2]),
                       new THREE.Vector3(face.normal_coord[(face.tri_indexes[i + 1 ] * 3)    ], 
                                         face.normal_coord[(face.tri_indexes[i + 1 ] * 3) + 1], 
                                         face.normal_coord[(face.tri_indexes[i + 1 ] * 3) + 2]),
                       new THREE.Vector3(face.normal_coord[(face.tri_indexes[i + 2 ] * 3)    ], 
                                         face.normal_coord[(face.tri_indexes[i + 2 ] * 3) + 1], 
                                         face.normal_coord[(face.tri_indexes[i + 2 ] * 3) + 2])],
                       new THREE.Color(face.face_index, globalFaceIndex, 0)
        ));
      }
      globalFaceIndex++;
      vInd += face.vertex_coord.length / 3;
    });

    // Compile the connected vertices and faces into a model
    // And add to the scene
    let geometry          = new THREE.Geometry();
        geometry.vertices = vertices;
        geometry.faces    = triangles;
    let model = new THREE.Mesh(geometry, this.matcapMaterial);
    model.castShadow = true;
    model.name = "Model Faces";
    this.mainObject.add(model);
    //End Adding Triangulated Faces

    // Add Highlightable Edges to Object
    // This wild complexity is what allows all of the lines to be drawn in a single draw call
    // AND highlighted on a per-edge basis by the mouse hover.  On the docket for refactoring.
    let lineVertices = []; let globalEdgeIndices = [];
    let curGlobalEdgeIndex = 0; let edgeVertices = 0;
    let globalEdgeMetadata = {}; globalEdgeMetadata[-1] = { start: -1, end: -1 };
    edgelist.forEach((edge) => {
      let edgeMetadata = {};
      edgeMetadata.localEdgeIndex = edge.edge_index;
      edgeMetadata.start = globalEdgeIndices.length;
      for (let i = 0; i < edge.vertex_coord.length-3; i += 3) {
        lineVertices.push(new THREE.Vector3(edge.vertex_coord[i    ],
                                            edge.vertex_coord[i + 1],
                                            edge.vertex_coord[i + 2]));
                  
        lineVertices.push(new THREE.Vector3(edge.vertex_coord[i     + 3],
                                            edge.vertex_coord[i + 1 + 3],
                                            edge.vertex_coord[i + 2 + 3]));
        globalEdgeIndices.push(curGlobalEdgeIndex); globalEdgeIndices.push(curGlobalEdgeIndex);
        edgeVertices++;
      }
      edgeMetadata.end = globalEdgeIndices.length-1;
      globalEdgeMetadata[curGlobalEdgeIndex] = edgeMetadata;
      curGlobalEdgeIndex++;
    });

    let lineGeometry = new THREE.BufferGeometry().setFromPoints(lineVertices);
    let lineColors = []; for ( let i = 0; i < lineVertices.length; i++ ) { lineColors.push( 0, 0, 0 ); }
    lineGeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( lineColors, 3 ) );
    let lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff, linewidth: 1.5, vertexColors: true });
    let line = new THREE.LineSegments(lineGeometry, lineMaterial);
    line.globalEdgeIndices = globalEdgeIndices;
    line.name = "Model Edges";
    line.lineColors = lineColors;
    line.globalEdgeMetadata = globalEdgeMetadata;
    line.highlightEdgeAtLineIndex = function (lineIndex) {
      let edgeIndex  = lineIndex >=0 ?this.globalEdgeIndices [lineIndex] : lineIndex;
      let startIndex = this.globalEdgeMetadata[edgeIndex].start;
      let endIndex   = this.globalEdgeMetadata[edgeIndex].end;
      for (let i = 0; i < this.lineColors.length; i++) {
        let colIndex       = Math.floor(i / 3);
        this.lineColors[i] = (colIndex >= startIndex && colIndex <= endIndex) ? 1 : 0; 
      }
      this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.lineColors, 3));
      this.geometry.colorsNeedUpdate = true;
    }.bind(line);
    line.getEdgeMetadataAtLineIndex = function (lineIndex) {
      return this.globalEdgeMetadata[this.globalEdgeIndices[lineIndex]];
    }.bind(line);
    line.clearHighlights = function () {
      return this.highlightEdgeAtLineIndex(-1);
    }.bind(line);
    this.mainObject.add(line);
    // End Adding Highlightable Edges

    // Expand fog distance to enclose the current object; always expand
    //  otherwise you can lose the object if it gets smaller again)
    this.boundingBox = new THREE.Box3().setFromObject(this.mainObject);
    this.fogDist = Math.max(this.fogDist, this.boundingBox.min.distanceTo(this.boundingBox.max)*1.5);
    this.environment.scene.fog = new THREE.Fog(this.environment.backgroundColor, this.fogDist, this.fogDist + 400);
    
    this.environment.scene.add(this.mainObject);
    this.environment.viewDirty = true;
    console.log("Generation Complete!");
  }

  /** Save the current shape to .stl */
  this.saveShapeSTEP = (filename = "CascadeStudioPart.step") => {
    // Ask the worker thread for a STEP file of the current space
    cascadeStudioWorker.postMessage({
      "type": "saveShapeSTEP",
      payload: filename
    });

    // Receive the STEP File from the Worker Thread
    messageHandlers["saveShapeSTEP"] = (stepURL) => {
      let link      = document.createElement("a");
      link.href     = stepURL;
      link.download = filename;
      link.click();
    };
  }

  /**  Save the current shape to an ASCII .stl */
  this.saveShapeSTL = (filename = "CascadeStudioPart.stl") => {
    this.stlExporter = new THREE.STLExporter();
    let result = this.stlExporter.parse(this.mainObject);
    let link = document.createElement("a");
    link.href = URL.createObjectURL( new Blob([result], { type: 'text/plain' }) );
		link.download = filename;
		link.click();
  }

  /**  Save the current shape to .obj */
  this.saveShapeOBJ = (filename = "CascadeStudioPart.obj") => {
    this.objExporter = new THREE.OBJExporter();
    let result = this.objExporter.parse(this.mainObject);
    let link = document.createElement("a");
    link.href = URL.createObjectURL( new Blob([result], { type: 'text/plain' }) );
		link.download = filename;
		link.click();
  }

  /** Set up the the Mouse Move Callback */
  this.mouse = { x: 0, y: 0 };
  this.goldenContainer.getElement().get(0).addEventListener('mousemove', (event) => {
    this.mouse.x =   ( event.offsetX / this.goldenContainer.width  ) * 2 - 1;
    this.mouse.y = - ( event.offsetY / this.goldenContainer.height ) * 2 + 1;
  }, false );

  this.animate = function animatethis() {
    requestAnimationFrame(() => this.animate());
    
    // Lightly Highlight the faces of the object and the current face/edge index
    // This wild complexity is largely to handle the fact that all the faces and lines
    // are being drawn in a single drawcall.  This is also on the docket for refactoring.
    if (this.mainObject) {
      this.raycaster.setFromCamera(this.mouse, this.environment.camera);
      let intersects = this.raycaster.intersectObjects(this.mainObject.children);
      if (this.environment.controls.state < 0 && intersects.length > 0) {
        let isLine = intersects[0].object.type === "LineSegments";
        let newIndex = isLine ? intersects[0].object.getEdgeMetadataAtLineIndex(intersects[0].index).localEdgeIndex : 
                                intersects[0].face.color.r;
        if (this.highlightedObj != intersects[0].object || this.highlightedIndex !== newIndex) {
          if (this.highlightedObj) {
            this.highlightedObj.material.color.setHex(this.highlightedObj.currentHex);
            if (this.highlightedObj && this.highlightedObj.clearHighlights) { this.highlightedObj.clearHighlights(); }
          }
          this.highlightedObj = intersects[0].object;
          this.highlightedObj.currentHex = this.highlightedObj.material.color.getHex();
          this.highlightedObj.material.color.setHex(0xffffff);
          this.highlightedIndex = newIndex;
          if (isLine) { this.highlightedObj.highlightEdgeAtLineIndex(intersects[0].index); }
          this.environment.viewDirty = true;
        }

        let indexHelper = (isLine ? "Edge" : "Face") + " Index: " + this.highlightedIndex;
        this.goldenContainer.getElement().get(0).title = indexHelper;
      } else {
        if (this.highlightedObj) {
          this.highlightedObj.material.color.setHex(this.highlightedObj.currentHex);
          if (this.highlightedObj.clearHighlights) { this.highlightedObj.clearHighlights(); }
          this.environment.viewDirty = true;
        }
        
        this.highlightedObj = null;
        this.goldenContainer.getElement().get(0).title = "";
      }
    }

    if (this.handles && this.handles.length > 0) {
      for (let i = 0; i < this.handles.length; i++){
        this.environment.viewDirty = this.handles[i].dragging || this.environment.viewDirty;
      }
    }

    // Rotate the camera with clicks from the view cube
    if (this.targetDirection) {
      let fullDelta = new THREE.Quaternion().setFromUnitVectors(
        this.environment.camera.getWorldDirection().clone().negate(),
        this.targetDirection);
      let workingQuat = new THREE.Quaternion();
      if (workingQuat.angleTo(fullDelta) > 0.01) {
        workingQuat.slerp(fullDelta, 0.2);
      } else {
        this.targetDirection = null;
      }

      this.environment.camera.position.copy(this.environment.camera.position.clone()
        .sub(this.environment.controls.target)
        .applyQuaternion(workingQuat)
        .add(this.environment.controls.target));

      this.environment.viewDirty = true;
      this.environment.controls.update();
    }

    // Place the View Cube in the Corner and Interpret Clicks
    this.environment.camera.updateMatrixWorld();
    this.viewCube.position.copy(new THREE.Vector3(-0.75, 0.75, 0.75).unproject(this.environment.camera));
    let intersects = this.raycaster.intersectObject(this.viewCube);
    if (intersects.length > 0 && this.environment.controls.state === 0) {
      this.targetDirection = intersects[0].face.normal;
    }
    
    // Only render the Three.js Viewport if the View is Dirty
    // This saves on rendering time/cost now, but may 
    // create headaches in the future.
    if (this.environment.viewDirty) {
      this.environment.renderer.render(this.environment.scene, this.environment.camera);
      this.environment.viewDirty = false;
    }
  };
  
  // Patch in the Handle Gizmo Code
  initializeHandleGizmos(this);

  this.animate();
  // Initialize the view in-case we're lazy rendering...
  this.environment.renderer.render(this.environment.scene, this.environment.camera);
}

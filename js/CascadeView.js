var Environment = function (goldenContainer) {
    this.time = new THREE.Clock();
    this.time.autoStart = true;
    this.lastTimeRendered = 0.0;
    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 2000); //new THREE.OrthographicCamera(300 / - 2, 300 / 2, 300 / 2, 300 / - 2, 1, 1000);
    this.scene = new THREE.Scene();
    this.isVisible = true;
    this.viewDirty = true; 
    this.goldenContainer = goldenContainer;
  
    this.initEnvironment = function () {
      this.camera.position.set(50, 100, 150);
      this.camera.lookAt(0, 45, 0);
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x222222);//0xa0a0a0
      this.scene.fog = new THREE.Fog(0x222222, 200, 600);//0xa0a0a0
  
      var light = new THREE.HemisphereLight(0xffffff, 0x444444);
      light.position.set(0, 200, 0);
      this.light2 = new THREE.DirectionalLight(0xbbbbbb);
      this.light2.position.set(6, 50, -12);
      this.light2.castShadow = true;
      this.light2.shadow.camera.top      =  100;
      this.light2.shadow.camera.bottom   = -100;
      this.light2.shadow.camera.left     = -100;
      this.light2.shadow.camera.right    =  100;
      //this.light2.shadow.radius          =  32;
      this.light2.shadow.mapSize.width  =  64;
      this.light2.shadow.mapSize.height =  64;

      this.scene.add(light);
      this.scene.add(this.light2);
      //this.scene.add(new THREE.CameraHelper(this.light2.shadow.camera));
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
      this.grid = new THREE.GridHelper(2000, 20, 0xcccccc, 0xcccccc);
      this.grid.position.y = -0.01;
      this.grid.material.opacity = 0.3;
      this.grid.material.transparent = true;
      this.scene.add(this.grid);
  
      var curCanvas = document.createElement('canvas');
      //curCanvas.id = canvasId;
      //document.currentScript.parentNode.insertBefore(curCanvas, document.currentScript.nextSibling);
      goldenContainer.getElement().get(0).appendChild(curCanvas);
      this.renderer = new THREE.WebGLRenderer({ canvas: curCanvas, antialias: true, webgl2: false });
      this.renderer.setPixelRatio(1);
      var parentWidth  = this.goldenContainer.width;
      let parentHeight = this.goldenContainer.height;
      this.renderer.setSize(parentWidth, parentHeight);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.camera.aspect = parentWidth / parentHeight;
      this.camera.updateProjectionMatrix();

      this.goldenContainer.on('resize', this.onWindowResize.bind(this));
  
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 45, 0);
      this.controls.panSpeed = 2;
      this.controls.zoomSpeed = 1;
      this.controls.screenSpacePanning = true;
      this.controls.update();
      this.controls.addEventListener('change', () => this.viewDirty = true);

      this.goldenContainer.layoutManager.eventHub.emit('Start');
    }

    this.onWindowResize = function () {
        this.goldenContainer.layoutManager.updateSize(window.innerWidth, window.innerHeight -
          document.getElementsByClassName('topnav')[0].offsetHeight);
        this.camera.aspect  = this.goldenContainer.width / this.goldenContainer.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.goldenContainer.width, this.goldenContainer.height);
        this.renderer.render(this.scene, this.camera);
    }
  
    this.initEnvironment();
  }
  
  var CascadeEnvironment = function (goldenContainer) {
    this.goldenContainer = goldenContainer;
    this.environment     = new Environment(this.goldenContainer);
    this.updating        = false;
    this.raycaster       = new THREE.Raycaster();
    this.highlightedObj  = null;
    this.handles         = [];
    this.gizmoMode       = "translate";
    this.gizmoSpace      = "local";

    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin ('');
    this.matcap = this.loader.load ('./textures/dullFrontLitMetal.png');
    //this.matcapMaterial = ;

    this.mouse = { x: 0, y: 0 };
    this.goldenContainer.getElement().get(0).addEventListener('mousemove', (event) => {
      this.mouse.x =   ( event.offsetX / this.goldenContainer.width  ) * 2 - 1;
      this.mouse.y = - ( event.offsetY / this.goldenContainer.height ) * 2 + 1;
    }, false );

    messageHandlers["combineAndRenderShapes"] = ([facelist, edgelist]) => {
      workerWorking = false;
      if (!facelist) { return;}

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

      // Slots the lists into the Geometry
      let geometry          = new THREE.Geometry();
          geometry.vertices = vertices;
          geometry.faces    = triangles;
      let model = new THREE.Mesh(geometry,
        new THREE.MeshMatcapMaterial({
          color: new THREE.Color(0xf5f5f5),
          matcap: this.matcap,
          polygonOffset: true, // Push the mesh back for line drawing
          polygonOffsetFactor: 2.0,
          polygonOffsetUnits: 1.0
        }));
      model.castShadow = true;
      model.name = "Model Faces";
      this.mainObject.add(model);
      //End Triangulated Faces

      // Add Highlightable Edges to Object
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
      // End Highlightable Edges

      this.environment.scene.add(this.mainObject);
      console.log("Generation Complete!");
    }

    // Save the current shape to .stl
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

    // Save the current shape to .stl
    this.saveShapeSTL = (filename = "CascadeStudioPart.stl") => {
      this.stlExporter = new THREE.STLExporter();
      let result = this.stlExporter.parse(this.mainObject);
      let link = document.createElement("a");
      link.href = URL.createObjectURL( new Blob([result], { type: 'text/plain' }) );
			link.download = filename;
			link.click();
    }

    // Save the current shape to .obj
    this.saveShapeOBJ = (filename = "CascadeStudioPart.obj") => {
      this.objExporter = new THREE.OBJExporter();
      let result = this.objExporter.parse(this.mainObject);
      let link = document.createElement("a");
      link.href = URL.createObjectURL( new Blob([result], { type: 'text/plain' }) );
			link.download = filename;
			link.click();
    }

    messageHandlers["createTransformHandle"] = (payload) => {
      if (payload.lineAndColumn[0] <= 0) {
        console.error("Transform Gizmo not supported in this browser!  Use Chrome or Firefox!"); return null;
      }
      let handle = new THREE.TransformControls(this.environment.camera,
                                               this.environment.renderer.domElement);
      handle.setTranslationSnap( 1 );
      handle.setRotationSnap( THREE.MathUtils.degToRad( 1 ) );
      handle.setScaleSnap(0.05);
      handle.setMode(this.gizmoMode);
      handle.setSpace(this.gizmoSpace);
      handle.lineAndColumn = payload.lineAndColumn;
      handle.onChanged = (event) => {
        this.environment.controls.enabled = !event.value;

        // Inject transform data back into the editor upon completion
        if (this.environment.controls.enabled) {
          let code = monacoEditor.getValue().split("\n");
          let lineNum = handle.lineAndColumn[0] - 1;

          let translateString = "[" +
             handle.placeHolder.position.x.toFixed() + ", " +
            -handle.placeHolder.position.z.toFixed() + ", " +
             handle.placeHolder.position.y.toFixed() + "]";
          let axisAngle = [[0, 0, 0], 0];
          let q = handle.placeHolder.quaternion;
          if ((1 - (q.w * q.w)) > 0.001) {
            axisAngle = [[
               q.x / Math.sqrt(1 - q.w * q.w),
              -q.z / Math.sqrt(1 - q.w * q.w),
               q.y / Math.sqrt(1 - q.w * q.w),
            ], 2 * Math.acos(q.w) * 57.2958];
          }
          let rotateString = "[[" +
            axisAngle[0][0].toFixed(2) +  ", " + 
            axisAngle[0][1].toFixed(2) +  ", " + 
            axisAngle[0][2].toFixed(2) + "], " + 
            axisAngle[1]   .toFixed(2) + "]";
          let scaleString = handle.placeHolder.scale.x.toFixed(2); // Use this properly later
          let updateString = "Transform(" + translateString + ", " + rotateString + ", " + scaleString + ",";

          let fullSwapped = code[lineNum]
            .replace(/(Transform\(\[(.*?)\]\,\s*\[\[(.*?)\,(.*?)\,(.*?)\]\,(.*?)]\, (.*?)\,)/, updateString);
          if (!code[lineNum].includes(updateString)) { // Only update if the transform has changed!
            if (fullSwapped === code[lineNum]) {
              code[lineNum] = code[lineNum]
                .replace(/(Transform\()/g, updateString + " "); // Initialize all the arguments
            } else {
              code[lineNum] = fullSwapped;
            }

            let newCode = "";
            code.forEach((codeLine) => { newCode += codeLine + "\n"; });
            monacoEditor.setValue(newCode.slice(0, -1));
            monacoEditor.evaluateCode(false);
          }
        }
      };
      handle.addEventListener('dragging-changed', handle.onChanged);
      
      // Create a fake object for the handle to attach to
      let emptyObject = new THREE.Group();
      emptyObject.position.set(payload.translation[0], payload.translation[2], -payload.translation[1]);
      emptyObject.setRotationFromAxisAngle(
        new THREE.Vector3(payload.rotation[0][0], payload.rotation[0][2], -payload.rotation[0][1]), payload.rotation[1] * 0.0174533);
      emptyObject.scale.set(payload.scale, payload.scale, payload.scale);
      this.environment.scene.add(emptyObject);
      handle.placeHolder = emptyObject;
      handle.attach(emptyObject);

      this.handles.push(handle);
      this.environment.scene.add(handle);
      //return handle;
    }
    this.clearTransformHandles = () => {
      this.handles.forEach((handle) => {
        handle.removeEventListener('dragging-changed', handle.onChanged);
        this.environment.scene.remove(handle.placeHolder);
        this.environment.scene.remove(handle);
      });
      this.handles = [];
    }
    window.addEventListener('keydown', (event) => {
      switch (event.keyCode) {
        // These match Unity's Hotkeys but I'm open to changing them
        case 88: // X
          this.gizmoSpace = (this.gizmoSpace === "local") ? "world" : "local";
          this.handles.forEach((handle) => { handle.setSpace(this.gizmoSpace); });
          break;
        case 87: // W
          this.gizmoMode = "translate";
          this.handles.forEach((handle) => {
            //handle.showX = true; handle.showY = true; handle.showZ = true;
            handle.setMode(this.gizmoMode);
          });
          break;
        case 69: // E
          this.gizmoMode = "rotate";
          this.handles.forEach((handle) => {
            //handle.showX = true; handle.showY = true; handle.showZ = true;
            handle.setMode(this.gizmoMode);
          });
          break;
        case 82: // R
          this.gizmoMode = "scale";
          this.handles.forEach((handle) => {
            //handle.showX = false; handle.showY = false; handle.showZ = false;
            handle.setMode(this.gizmoMode);
          });
          break;
      }
    });

    this.animate = function animatethis() {
      requestAnimationFrame(() => this.animate());

      // Lightly Highlight the faces of the object and the current face/edge index
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
          }
          //if (this.highlightedObj.hasOwnProperty("shapeIndex")) {
          let indexHelper = (isLine ? "Edge" : "Face") + " Index: " + this.highlightedIndex;
          this.goldenContainer.getElement().get(0).title = indexHelper;
          //}
        } else {
          if (this.highlightedObj) {
            this.highlightedObj.material.color.setHex(this.highlightedObj.currentHex);
            if (this.highlightedObj.clearHighlights) { this.highlightedObj.clearHighlights(); }
          }
          
          this.highlightedObj = null;
          this.goldenContainer.getElement().get(0).title = "";
        }
      }

      this.goldenContainer.layoutManager.eventHub.emit('Update');
      this.environment.renderer.render(this.environment.scene, this.environment.camera);
    };

    this.takeGalleryScreenshotasURI = () => {
      // Set to desired dimension and capture screenshot as uri
      let width = 512, height = 384;
      this.environment.camera.aspect = width / height;
      this.environment.camera.updateProjectionMatrix();
      this.environment.renderer.setSize(width, height);
      this.environment.renderer.render(this.environment.scene, this.environment.camera, null, false);
      let uri = this.environment.renderer.domElement.toDataURL('image/png');

      // Return to original dimensions
      this.environment.onWindowResize();

      return uri;
    }
  
    this.animate();
    // Initialize the view in-case we're lazy rendering...
    this.environment.renderer.render(this.environment.scene, this.environment.camera);
  }

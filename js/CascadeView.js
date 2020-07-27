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
                                       new THREE.MeshPhongMaterial  ({ color: 0x080808, depthWrite: false }));
      this.groundMesh.rotation.x = - Math.PI / 2;
      this.groundMesh.receiveShadow = true;
      this.scene.add(this.groundMesh);
      var grid = new THREE.GridHelper(2000, 20, 0xcccccc, 0xcccccc);
      grid.material.opacity = 0.3;
      grid.material.transparent = true;
      this.scene.add(grid);
  
      var curCanvas = document.createElement('canvas');
      //curCanvas.id = canvasId;
      //document.currentScript.parentNode.insertBefore(curCanvas, document.currentScript.nextSibling);
      goldenContainer.getElement().get(0).appendChild(curCanvas);
      this.renderer = new THREE.WebGLRenderer({ canvas: curCanvas, antialias: true });
      this.renderer.setPixelRatio(1);
      var parentWidth  = this.goldenContainer.width;
      let parentHeight = this.goldenContainer.height;
      this.renderer.setSize(parentWidth, parentHeight);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMapType = THREE.PCFSoftShadowMap;
      this.camera.aspect = parentWidth / parentHeight;
      this.camera.updateProjectionMatrix();

      this.goldenContainer.on('resize', this.onWindowResize.bind(this));
  
      this.draggableObjects = [this.ludic];
      //this.dragControls = new THREE.DragControls(this.draggableObjects, this.camera, this.renderer.domElement);
  
      //if (this.orbit) {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 45, 0);
        this.controls.panSpeed = 2;
        this.controls.zoomSpeed = 1;
        this.controls.screenSpacePanning = true;
        this.controls.update();
        this.controls.addEventListener('change', () => this.viewDirty = true);
        //this.dragControls.addEventListener('dragstart', (data) => { this.controls.enabled = false;  data.object._isDragging = true; });
        //this.dragControls.addEventListener('dragend', (data) => { this.controls.enabled = true; data.object._isDragging = false; });
      //}
      //this.dragControls.addEventListener('drag', () => this.viewDirty = true);
      this.goldenContainer.layoutManager.eventHub.emit('Start');
    }

    this.onWindowResize = function () {
        this.goldenContainer.layoutManager.updateSize(window.innerWidth, window.innerHeight -
          document.getElementsByClassName('topNav')[0].offsetHeight);
        this.camera.aspect  = this.goldenContainer.width / this.goldenContainer.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.goldenContainer.width, this.goldenContainer.height);
        this.renderer.render(this.scene, this.camera);
    }
  
    this.initEnvironment();
  }
  
  var CascadeEnvironment = function (goldenContainer, openCascade) {
    this.goldenContainer = goldenContainer;
    this.environment     = new Environment(this.goldenContainer);
    this.updating        = false;
    this.openCascade     = openCascade;
    this.raycaster       = new THREE.Raycaster();
    this.highlightedObj  = null;
  
    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin ('');
    this.matcap = this.loader.load ('./textures/dullFrontLitMetal.png');
    //this.matcapMaterial = ;

    this.mouse = { x: 0, y: 0 };
    this.goldenContainer.getElement().get(0).addEventListener('mousemove', (event) => {
      this.mouse.x =   ( event.offsetX / this.goldenContainer.width  ) * 2 - 1;
      this.mouse.y = - ( event.offsetY / this.goldenContainer.height ) * 2 + 1;
    }, false );

    this.updateShape = async (shape, maxDeviation) => {
      openCascadeHelper.setOpenCascade(this.openCascade);
      this.currentShape = shape;

      this.environment.scene.remove(this.mainObject);
      //this.mainObject.remove(...this.mainObject.children);
      this.mainObject            = new THREE.Group();
      this.mainObject.name       = "shape";
      this.mainObject.rotation.x = -Math.PI / 2;

      // Tesellate the OpenCascade Object
      const [facelist, edgelist] = await openCascadeHelper.tessellate(this.currentShape, maxDeviation);
      facelist.forEach((face) => {
        // Sort Vertices into three.js Vector3 List
        let vertices = [];
        for (let i = 0; i < face.vertex_coord.length; i += 3) {
          vertices.push(new THREE.Vector3(face.vertex_coord[i    ],
                                          face.vertex_coord[i + 1],
                                          face.vertex_coord[i + 2]));
        }
        // Sort Triangles into a three.js Face List
        let triangles = [];
        for (let i = 0; i < face.tri_indexes.length; i += 3) {
          triangles.push(new THREE.Face3(face.tri_indexes[i],face.tri_indexes[i + 1], face.tri_indexes[i + 2], 
                        [new THREE.Vector3(face.normal_coord[(face.tri_indexes[i     ] * 3)    ], 
                                           face.normal_coord[(face.tri_indexes[i     ] * 3) + 1], 
                                           face.normal_coord[(face.tri_indexes[i     ] * 3) + 2]),
                         new THREE.Vector3(face.normal_coord[(face.tri_indexes[i + 1 ] * 3)    ], 
                                           face.normal_coord[(face.tri_indexes[i + 1 ] * 3) + 1], 
                                           face.normal_coord[(face.tri_indexes[i + 1 ] * 3) + 2]),
                         new THREE.Vector3(face.normal_coord[(face.tri_indexes[i + 2 ] * 3)    ], 
                                           face.normal_coord[(face.tri_indexes[i + 2 ] * 3) + 1], 
                                           face.normal_coord[(face.tri_indexes[i + 2 ] * 3) + 2])]
          ));
        }

        // Slots the lists into the Geometry
        let geometry               = new THREE.Geometry();
            geometry.vertices      = vertices;
            geometry.faces         = triangles;
        let currentFace = new THREE.Mesh(geometry, new THREE.MeshMatcapMaterial(
          { color: new THREE.Color(0xeeeeee), matcap: this.matcap }));
        currentFace.castShadow = true;
        currentFace.shapeIndex = face.face_index;
        this.mainObject.add(currentFace);
      });

      // Draw Edges of Object
      edgelist.forEach((edge)=>{
        let vertices = [];
        for (let i = 0; i < edge.vertex_coord.length; i += 3) {
          vertices.push(new THREE.Vector3(edge.vertex_coord[i    ],
                                          edge.vertex_coord[i + 1],
                                          edge.vertex_coord[i + 2]));
        }
        let linegeometry = new THREE.BufferGeometry().setFromPoints( vertices );
        let linematerial = new THREE.LineBasicMaterial( { color: 0x000000, linewidth: 5 } );
        let line = new THREE.Line(linegeometry, linematerial);
        line.shapeIndex = edge.edge_index;
        this.mainObject.add(line);
      });

      this.environment.scene.add(this.mainObject);
    }

    // Save the current shape to .stl
    this.saveShapeSTEP = (filename = "CascadeStudioPart.step") => {
      this.writer = new oc.STEPControl_Writer();
      let transferResult = this.writer.Transfer(this.currentShape, 0);
      if(transferResult === 1){
        let writeResult = this.writer.Write(filename);
        if(writeResult === 1){
          let stepFileText = oc.FS.readFile("/" + filename, { encoding:"utf8" });

          let link = document.createElement("a");
          link.href = URL.createObjectURL( new Blob([stepFileText], { type: 'text/plain' }) );
          link.download = filename;
          link.click();

          oc.FS.unlink("/" + filename);
        }else{
          console.error("WRITE STEP FILE FAILED.");
        }
      }else{
        console.error("TRANSFER TO STEP WRITER FAILED.");
      }
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
  
    this.animate = function animatethis() {
      requestAnimationFrame(() => this.animate());

      // Lightly Highlight the faces of the object
      if (this.mainObject) {
        this.raycaster.setFromCamera(this.mouse, this.environment.camera);
        let intersects = this.raycaster.intersectObjects(this.mainObject.children);
        if (intersects.length > 0) {
          if (this.highlightedObj != intersects[0].object) {
            if (this.highlightedObj) this.highlightedObj.material.color.setHex(this.highlightedObj.currentHex);
            this.highlightedObj = intersects[0].object;
            this.highlightedObj.currentHex = this.highlightedObj.material.color.getHex();
            this.highlightedObj.material.color.setHex(0xffffff);
          }
          if (this.highlightedObj.hasOwnProperty("shapeIndex")) {
            let is_line = "computeLineDistances" in this.highlightedObj;
            let indexHelper = (is_line ? "Edge" : "Face")+ " Index: " + this.highlightedObj.shapeIndex;
            this.goldenContainer.getElement().get(0).title = indexHelper;
          }
        } else {
          if (this.highlightedObj) this.highlightedObj.material.color.setHex(this.highlightedObj.currentHex);
          this.highlightedObj = null;
          this.goldenContainer.getElement().get(0).title = "";
        }
      }

      this.goldenContainer.layoutManager.eventHub.emit('Update');
      this.environment.renderer.render(this.environment.scene, this.environment.camera);
    };
  
    this.animate();
    // Initialize the view in-case we're lazy rendering...
    this.environment.renderer.render(this.environment.scene, this.environment.camera);
  }

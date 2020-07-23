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
      this.scene.background = new THREE.Color(0xffffff);//0xa0a0a0
      this.scene.fog = new THREE.Fog(0xffffff, 200, 600);//0xa0a0a0
  
      var light = new THREE.HemisphereLight(0xffffff, 0x444444);
      light.position.set(0, 200, 0);
      this.light2 = new THREE.DirectionalLight(0xbbbbbb);
      this.light2.position.set(0, 200, 100);
      this.light2.castShadow = true;
      this.light2.shadow.camera.top = 180;
      this.light2.shadow.camera.bottom = - 100;
      this.light2.shadow.camera.left = - 120;
      this.light2.shadow.camera.right = 120;
      this.scene.add(light);
      this.scene.add(this.light2);
      //scene.add(new THREE.CameraHelper(light.shadow.camera));
      this.groundMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2000, 2000),
                                       new THREE.MeshPhongMaterial  ({ color: 0x999999, depthWrite: false }));
      this.groundMesh.rotation.x = - Math.PI / 2;
      this.groundMesh.receiveShadow = true;
      this.scene.add(this.groundMesh);
      var grid = new THREE.GridHelper(2000, 20, 0x000000, 0x000000);
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
  
    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin ('');
    this.matcap = this.loader.load ('./textures/dullFrontLitMetal.png');
    this.matcapMaterial = new THREE.MeshMatcapMaterial( {
      //color: THREE.API.color,
      matcap: this.matcap
    } );

    this.boxGeometry = new THREE.BoxBufferGeometry(100, 100, 100);
    //this.white       = new THREE.MeshLambertMaterial({ color: 0x888888 });
    this.mainObject;

    this.updateShape = async (shape) => {
      openCascadeHelper.setOpenCascade(this.openCascade);
      const facelist                                        = await openCascadeHelper.tessellate(shape);
      const [locVertexcoord, locNormalcoord, locTriIndices] = await openCascadeHelper.joinPrimitives(facelist);
      const tot_triangle_count                              = facelist.reduce((a,b) => a + b.number_of_triangles, 0);
      const [vertices, faces]                               = await openCascadeHelper.generateGeometry(
                                                                tot_triangle_count, locVertexcoord, locNormalcoord, locTriIndices);
      //const objectMat   = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.7, 0.7, 0.7) });
      const geometry    = new THREE.Geometry();
      geometry.vertices = vertices;
      geometry.faces    = faces;
      
      this.environment.scene.remove(this.mainObject);
      this.mainObject   = new THREE.Mesh(geometry, this.matcapMaterial);
      this.mainObject.name       = "shape";
      this.mainObject.rotation.x = -Math.PI / 2;
      this.environment.scene.add(this.mainObject);
    }
  
    this.animate = function animatethis() {
      requestAnimationFrame(() => this.animate());
      this.goldenContainer.layoutManager.eventHub.emit('Update');
      this.environment.renderer.render(this.environment.scene, this.environment.camera);
    };
  
    this.animate();
    // Initialize the view in-case we're lazy rendering...
    this.environment.renderer.render(this.environment.scene, this.environment.camera);
  }

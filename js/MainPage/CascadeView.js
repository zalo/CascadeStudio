// This file governs the 3D Viewport which displays the 3D Model
// It is also in charge of saving to STL and OBJ
import * as THREE from 'three';
import { OrbitControls } from '../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { STLExporter } from '../../node_modules/three/examples/jsm/exporters/STLExporter.js';
import { OBJExporter } from '../../node_modules/three/examples/jsm/exporters/OBJExporter.js';
import { HandleManager } from './CascadeViewHandles.js';

/** Base class for a 3D viewport environment.
 *  Includes floor, grid, fog, camera, lights, and orbit controls. */
class Environment {
  constructor(goldenContainer) {
    this.goldenContainer = goldenContainer;

    // Get the current Width and Height of the Parent Element
    this.parentWidth  = this.goldenContainer.width;
    this.parentHeight = this.goldenContainer.height;

    // Create the Canvas and WebGL Renderer
    this.curCanvas = document.createElement('canvas');
    this.goldenContainer.element.appendChild(this.curCanvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.curCanvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.parentWidth, this.parentHeight);
    this.goldenContainer.on('resize', this.onWindowResize.bind(this));

    // Create the Three.js Scene
    this.scene = new THREE.Scene();
    this.backgroundColor  = 0x222222;
    this.scene.background = new THREE.Color(this.backgroundColor);
    this.scene.fog        = new THREE.Fog(this.backgroundColor, 200, 600);

    this.camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
    this.camera.position.set(50, 100, 150);
    this.camera.lookAt(0, 45, 0);
    this.camera.aspect = this.parentWidth / this.parentHeight;
    this.camera.updateProjectionMatrix();

    // Create two lights to evenly illuminate the model and cast shadows
    this.light  = new THREE.HemisphereLight(0xffffff, 0x444444);
    this.light.position.set(0, 200, 0);
    this.light2 = new THREE.DirectionalLight(0xbbbbbb);
    this.light2.position.set(6, 50, -12);
    this.light2.castShadow = true;
    this.light2.shadow.camera.top      =  200;
    this.light2.shadow.camera.bottom   = -200;
    this.light2.shadow.camera.left     = -200;
    this.light2.shadow.camera.right    =  200;
    this.light2.shadow.mapSize.width   =  128;
    this.light2.shadow.mapSize.height  =  128;
    this.scene.add(this.light);
    this.scene.add(this.light2);
    this.renderer.shadowMap.enabled    = true;
    this.renderer.shadowMap.type       = THREE.PCFSoftShadowMap;

    // Set up the orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 45, 0);
    this.controls.panSpeed  = 2;
    this.controls.zoomSpeed = 1;
    this.controls.screenSpacePanning = true;
    this.controls.update();

    // Keep track of the last time the scene was interacted with
    this.controls.addEventListener('change', () => this.viewDirty = true);
    this.isVisible = true;
    this.viewDirty = true;
    this.time = new THREE.Clock();
    this.time.autoStart = true;
    this.lastTimeRendered = 0.0;

    this.goldenContainer.layoutManager.eventHub.emit('Start');
  }

  /** Resize the container, canvas, and renderer when the window resizes. */
  onWindowResize() {
    this.goldenContainer.layoutManager.updateSize(
      window.innerWidth,
      window.innerHeight - document.getElementsByClassName('topnav')[0].offsetHeight
    );
    this.camera.aspect = this.goldenContainer.width / this.goldenContainer.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.goldenContainer.width, this.goldenContainer.height);
    this.renderer.render(this.scene, this.camera);
    this.viewDirty = true;
  }
}

/** CAD-specific 3D viewport that extends Environment with shape rendering,
 *  edge/face highlighting, export functionality, and transform gizmos. */
class CascadeEnvironment {
  constructor(goldenContainer, messageBus, getNewFileHandle, writeFile, downloadFile) {
    this.active          = true;
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
    this.loader = new THREE.TextureLoader();
    this.loader.setCrossOrigin('');
    this.matcap = this.loader.load('./textures/dullFrontLitMetal.png', () => {
      this.environment.viewDirty = true;
    });
    this.matcapMaterial = new THREE.MeshMatcapMaterial({
      color: new THREE.Color(0xf5f5f5),
      matcap: this.matcap,
      polygonOffset: true,
      polygonOffsetFactor: 2.0,
      polygonOffsetUnits: 1.0
    });

    // Store dependencies for export methods
    this._messageBus = messageBus;
    this._getNewFileHandle = getNewFileHandle;
    this._writeFile = writeFile;
    this._downloadFile = downloadFile;

    // Modeling history timeline state
    this._historySteps = [];       // Metadata from worker: [{fnName, lineNumber, shapeCount}, ...]
    this._historyMeshCache = {};   // stepIndex → [facelist, edgelist]
    this._historyCurrentStep = -1; // -1 = showing final result (default)
    this._historyObject = null;    // THREE.Group for the history preview
    this._historyPending = false;  // True while awaiting worker mesh response
    this._lastSceneOptions = {};

    // Register the shape rendering callback
    this._registerRenderCallback(messageBus);

    // Register the modeling history callback
    this._registerHistoryCallback(messageBus);

    // Set up mouse tracking
    this.mouse = { x: 0, y: 0 };
    this.goldenContainer.element.addEventListener('mousemove', (event) => {
      this.mouse.x =   (event.offsetX / this.goldenContainer.width) * 2 - 1;
      this.mouse.y = - (event.offsetY / this.goldenContainer.height) * 2 + 1;
    }, false);

    // Create the timeline overlay DOM
    this._createTimelineOverlay();

    // Initialize the Handle Manager
    this.handleManager = new HandleManager(this, messageBus);

    // Start the animation loop
    this._animate();
    this.environment.renderer.render(this.environment.scene, this.environment.camera);
  }

  /** Build a THREE.Group from facelist/edgelist mesh data. */
  _buildObjectFromMesh(facelist, edgelist) {
    let group = new THREE.Group();
    group.name = "shape";
    group.rotation.x = -Math.PI / 2;

    // Add Triangulated Faces to Object
    let vertices = [], normals = [], triangles = [], uvs = [], colors = [];
    let vInd = 0; let globalFaceIndex = 0;
    facelist.forEach((face) => {
      vertices.push(...face.vertex_coord);
      normals.push(...face.normal_coord);
      uvs.push(...face.uv_coord);

      for (let i = 0; i < face.tri_indexes.length; i += 3) {
        triangles.push(
          face.tri_indexes[i + 0] + vInd,
          face.tri_indexes[i + 1] + vInd,
          face.tri_indexes[i + 2] + vInd
        );
      }

      for (let i = 0; i < face.vertex_coord.length; i += 3) {
        colors.push(face.face_index, globalFaceIndex, 0);
      }

      globalFaceIndex++;
      vInd += face.vertex_coord.length / 3;
    });

    let geometry = new THREE.BufferGeometry();
    geometry.setIndex(triangles);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    let model = new THREE.Mesh(geometry, this.matcapMaterial);
    model.castShadow = true;
    model.name = "Model Faces";
    group.add(model);

    // Add Highlightable Edges to Object
    let lineVertices = []; let globalEdgeIndices = [];
    let curGlobalEdgeIndex = 0;
    let globalEdgeMetadata = {}; globalEdgeMetadata[-1] = { start: -1, end: -1 };
    edgelist.forEach((edge) => {
      let edgeMetadata = {};
      edgeMetadata.localEdgeIndex = edge.edge_index;
      edgeMetadata.start = globalEdgeIndices.length;
      for (let i = 0; i < edge.vertex_coord.length - 3; i += 3) {
        lineVertices.push(new THREE.Vector3(
          edge.vertex_coord[i], edge.vertex_coord[i + 1], edge.vertex_coord[i + 2]
        ));
        lineVertices.push(new THREE.Vector3(
          edge.vertex_coord[i + 3], edge.vertex_coord[i + 1 + 3], edge.vertex_coord[i + 2 + 3]
        ));
        globalEdgeIndices.push(curGlobalEdgeIndex);
        globalEdgeIndices.push(curGlobalEdgeIndex);
      }
      edgeMetadata.end = globalEdgeIndices.length - 1;
      globalEdgeMetadata[curGlobalEdgeIndex] = edgeMetadata;
      curGlobalEdgeIndex++;
    });

    let lineGeometry = new THREE.BufferGeometry().setFromPoints(lineVertices);
    let lineColors = [];
    for (let i = 0; i < lineVertices.length; i++) { lineColors.push(0, 0, 0); }
    lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
    let lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff, linewidth: 1.5, vertexColors: true
    });
    let line = new THREE.LineSegments(lineGeometry, lineMaterial);
    line.globalEdgeIndices = globalEdgeIndices;
    line.name = "Model Edges";
    line.lineColors = lineColors;
    line.globalEdgeMetadata = globalEdgeMetadata;
    line.highlightEdgeAtLineIndex = function (lineIndex) {
      let edgeIndex  = lineIndex >= 0 ? this.globalEdgeIndices[lineIndex] : lineIndex;
      let startIndex = this.globalEdgeMetadata[edgeIndex].start;
      let endIndex   = this.globalEdgeMetadata[edgeIndex].end;
      for (let i = 0; i < this.lineColors.length; i++) {
        let colIndex       = Math.floor(i / 3);
        this.lineColors[i] = (colIndex >= startIndex && colIndex <= endIndex) ? 1 : 0;
      }
      this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.lineColors, 3));
    }.bind(line);
    line.getEdgeMetadataAtLineIndex = function (lineIndex) {
      return this.globalEdgeMetadata[this.globalEdgeIndices[lineIndex]];
    }.bind(line);
    line.clearHighlights = function () {
      return this.highlightEdgeAtLineIndex(-1);
    }.bind(line);
    group.add(line);

    return group;
  }

  /** Register the callback that receives triangulated shapes from the worker. */
  _registerRenderCallback(messageBus) {
    messageBus.on("combineAndRenderShapes", ([[facelist, edgelist], sceneOptions]) => {
      window.workerWorking = false;
      if (!facelist) { return; }
      if (!sceneOptions) { sceneOptions = {}; }
      this._lastSceneOptions = sceneOptions;

      // The old mainObject is dead! Long live the mainObject!
      this.environment.scene.remove(this.mainObject);

      this.environment.scene.remove(this.groundMesh);
      if (sceneOptions.groundPlaneVisible) {
        this.groundMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(2000, 2000),
          new THREE.MeshPhongMaterial({
            color: 0x080808, depthWrite: true, dithering: true,
            polygonOffset: true,
            polygonOffsetFactor: 6.0, polygonOffsetUnits: 1.0
          })
        );
        this.groundMesh.position.y = -0.1;
        this.groundMesh.rotation.x = -Math.PI / 2;
        this.groundMesh.receiveShadow = true;
        this.environment.scene.add(this.groundMesh);
      }

      this.environment.scene.remove(this.grid);
      if (sceneOptions.gridVisible) {
        this.grid = new THREE.GridHelper(2000, 20, 0xcccccc, 0xcccccc);
        this.grid.position.y = -0.01;
        this.grid.material.opacity = 0.3;
        this.grid.material.transparent = true;
        this.environment.scene.add(this.grid);
      }

      this.mainObject = this._buildObjectFromMesh(facelist, edgelist);

      // Expand fog distance to enclose the current object
      this.boundingBox = new THREE.Box3().setFromObject(this.mainObject);
      this.fogDist = Math.max(this.fogDist, this.boundingBox.min.distanceTo(this.boundingBox.max) * 1.5);
      this.environment.scene.fog = new THREE.Fog(this.environment.backgroundColor, this.fogDist, this.fogDist + 400);

      // Cache the final mesh data for the timeline's last step
      this._finalMeshData = [facelist, edgelist];

      // Reset timeline to show final result
      this._historyCurrentStep = -1;
      if (this._historyObject) {
        this.environment.scene.remove(this._historyObject);
        this._historyObject = null;
      }

      this.environment.scene.add(this.mainObject);
      this.environment.viewDirty = true;
      console.log("Generation Complete!");
    });
  }

  /** Register the callback that receives modeling history metadata from the worker. */
  _registerHistoryCallback(messageBus) {
    messageBus.on("modelHistory", (steps) => {
      this._historySteps = steps || [];
      this._historyMeshCache = {};
      this._historyCurrentStep = -1;
      this._updateTimelineDOM();
    });
  }

  /** Create the timeline overlay DOM elements. */
  _createTimelineOverlay() {
    this._timelineContainer = document.createElement('div');
    this._timelineContainer.className = 'cs-timeline';
    this._timelineContainer.style.display = 'none';
    this.goldenContainer.element.appendChild(this._timelineContainer);

    // Track container holds the step icons
    this._timelineTrack = document.createElement('div');
    this._timelineTrack.className = 'cs-timeline-track';
    this._timelineContainer.appendChild(this._timelineTrack);

    // Scrubbing state
    this._isScrubbing = false;

    this._timelineTrack.addEventListener('mousedown', (e) => {
      this._isScrubbing = true;
      this._scrubToPosition(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (this._isScrubbing) this._scrubToPosition(e);
    });
    window.addEventListener('mouseup', () => {
      this._isScrubbing = false;
    });
  }

  /** Map a mouse event to the closest timeline step element. */
  _scrubToPosition(e) {
    let children = this._timelineTrack.children;
    if (children.length === 0) return;

    // Find the step element closest to the mouse X
    let mouseX = e.clientX;
    let closestIndex = 0;
    let closestDist = Infinity;
    for (let i = 0; i < children.length; i++) {
      let rect = children[i].getBoundingClientRect();
      let centerX = rect.left + rect.width / 2;
      let dist = Math.abs(mouseX - centerX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }

    if (closestIndex >= this._historySteps.length) {
      this._showFinalResult();
    } else {
      this._showHistoryStep(closestIndex);
    }
  }

  /** Show the final (fully evaluated) result. */
  _showFinalResult() {
    if (this._historyCurrentStep === -1) return;
    this._historyCurrentStep = -1;

    // Swap visibility: show mainObject, hide history preview
    if (this._historyObject) {
      this.environment.scene.remove(this._historyObject);
      this._historyObject = null;
    }
    if (this.mainObject) {
      this.mainObject.visible = true;
    }

    this._updateTimelineHighlight();
    this.environment.viewDirty = true;

    // Notify editor to clear line highlight
    if (this._onHistoryStepChange) this._onHistoryStepChange(null);
  }

  /** Show an intermediate history step. Triangulates lazily via worker request. */
  async _showHistoryStep(stepIndex) {
    if (stepIndex === this._historyCurrentStep) return;
    if (this._historyPending) return;
    this._historyCurrentStep = stepIndex;
    this._updateTimelineHighlight();

    // Notify editor to highlight the corresponding line
    let step = this._historySteps[stepIndex];
    if (this._onHistoryStepChange && step) {
      this._onHistoryStepChange(step.lineNumber);
    }

    // Hide the final mainObject
    if (this.mainObject) {
      this.mainObject.visible = false;
    }

    // Check mesh cache
    if (this._historyMeshCache[stepIndex]) {
      this._displayHistoryMesh(this._historyMeshCache[stepIndex]);
      return;
    }

    // Handle empty step (0 shapes)
    if (step && step.shapeCount === 0) {
      this._displayHistoryMesh(null);
      return;
    }

    // Request triangulation from worker
    this._historyPending = true;
    try {
      let meshData = await this._messageBus.request("meshHistoryStep", {
        stepIndex: stepIndex,
        maxDeviation: this._lastSceneOptions.meshRes || 0.1
      });
      this._historyMeshCache[stepIndex] = meshData;
      // Only display if we haven't scrubbed away during the await
      if (this._historyCurrentStep === stepIndex) {
        this._displayHistoryMesh(meshData);
      }
    } finally {
      this._historyPending = false;
    }
  }

  /** Display a pre-triangulated history mesh in the scene. */
  _displayHistoryMesh(meshData) {
    if (this._historyObject) {
      this.environment.scene.remove(this._historyObject);
      this._historyObject = null;
    }

    if (meshData) {
      let [facelist, edgelist] = meshData;
      if (facelist && facelist.length > 0) {
        this._historyObject = this._buildObjectFromMesh(facelist, edgelist);
        this.environment.scene.add(this._historyObject);
      }
    }

    this.environment.viewDirty = true;
  }

  /** Update the timeline DOM to reflect current history steps. */
  _updateTimelineDOM() {
    if (this._historySteps.length <= 1) {
      this._timelineContainer.style.display = 'none';
      return;
    }

    this._timelineContainer.style.display = '';
    this._timelineTrack.innerHTML = '';

    // Operation type → icon character (simple Unicode icons)
    const iconMap = {
      // Primitives
      'Box': '\u25A1',        // square
      'Sphere': '\u25CB',     // circle
      'Cylinder': '\u25AD',   // rectangle (horizontal)
      'Cone': '\u25B3',       // triangle up
      'Polygon': '\u2B23',    // hexagon
      'Circle': '\u25EF',     // large circle
      'BSpline': '\u223F',    // sine wave
      'Text3D': 'T',
      'Wedge': '\u25C7',      // diamond
      // Transforms
      'Translate': '\u2192',   // right arrow
      'Rotate': '\u21BB',     // clockwise arrow
      'Mirror': '\u2194',     // left-right arrow
      'Scale': '\u2922',      // NE arrow
      // Booleans
      'Union': '\u222A',      // union
      'Difference': '\u2216', // set minus
      'Intersection': '\u2229', // intersection
      // Operations
      'Extrude': '\u2191',    // up arrow
      'Revolve': '\u21BA',    // counterclockwise arrow
      'Offset': '\u29C9',     // two joined squares
      'Pipe': '\u2240',       // wreath product
      'Loft': '\u22C8',       // bowtie
      'Fillet': '\u25E0',     // upper half circle
      'Chamfer': '\u25FA',    // lower left triangle
      'Section': '\u2500',    // horizontal line
      'Shell': '\u25A2',      // square with rounded corners
      // Sketch operations
      'Sketch': '\u270E',     // pencil
      'MakeSolid': '\u25A0',  // filled square
      'MakeWire': '\u2312',   // arc
    };

    for (let i = 0; i <= this._historySteps.length; i++) {
      let dot = document.createElement('div');
      dot.className = 'cs-timeline-step';

      if (i < this._historySteps.length) {
        let step = this._historySteps[i];
        dot.textContent = iconMap[step.fnName] || '\u2022'; // bullet fallback
        dot.title = `${step.fnName}() — line ${step.lineNumber} (${step.shapeCount} shape${step.shapeCount !== 1 ? 's' : ''})`;
      } else {
        // Final result marker
        dot.textContent = '\u2713'; // checkmark
        dot.title = 'Final result';
        dot.classList.add('cs-timeline-final');
      }

      this._timelineTrack.appendChild(dot);
    }

    this._updateTimelineHighlight();
  }

  /** Highlight the current step in the timeline. */
  _updateTimelineHighlight() {
    let steps = this._timelineTrack.children;
    for (let i = 0; i < steps.length; i++) {
      let isActive;
      if (this._historyCurrentStep === -1) {
        isActive = (i === steps.length - 1); // final result
      } else {
        isActive = (i === this._historyCurrentStep);
      }
      steps[i].classList.toggle('cs-timeline-active', isActive);
    }
  }

  /** Save the current shape to .step. */
  saveShapeSTEP() {
    this._messageBus.send("saveShapeSTEP");

    this._messageBus.on("saveShapeSTEP", async (stepContent) => {
      if (window.showSaveFilePicker) {
        const fileHandle = await this._getNewFileHandle("STEP files", "text/plain", "step");
        this._writeFile(fileHandle, stepContent).then(() => {
          console.log("Saved STEP to " + fileHandle.name);
        });
      } else {
        await this._downloadFile(stepContent, "Untitled", "model/step", "step");
      }
    });
  }

  /** Save the current shape to an ASCII .stl. */
  async saveShapeSTL() {
    let stlExporter = new STLExporter();
    let result = stlExporter.parse(this.mainObject);
    if (window.showSaveFilePicker) {
      const fileHandle = await this._getNewFileHandle("STL files", "text/plain", "stl");
      this._writeFile(fileHandle, result).then(() => {
        console.log("Saved STL to " + fileHandle.name);
      });
    } else {
      await this._downloadFile(result, "Untitled", "model/stl", "stl");
    }
  }

  /** Save the current shape to .obj. */
  async saveShapeOBJ() {
    let objExporter = new OBJExporter();
    let result = objExporter.parse(this.mainObject);
    if (window.showSaveFilePicker) {
      const fileHandle = await this._getNewFileHandle("OBJ files", "text/plain", "obj");
      this._writeFile(fileHandle, result).then(() => {
        console.log("Saved OBJ to " + fileHandle.name);
      });
    } else {
      await this._downloadFile(result, "Untitled", "model/obj", "obj");
    }
  }

  /** Clear all transform handles. Delegates to HandleManager. */
  clearTransformHandles() {
    this.handleManager.clearTransformHandles();
  }

  /** Animation loop - handles highlighting and rendering. */
  _animate() {
    if (!this.active) { return; }

    requestAnimationFrame(() => this._animate());

    // Highlight faces/edges under the mouse cursor
    if (this.mainObject) {
      this.raycaster.setFromCamera(this.mouse, this.environment.camera);
      let intersects = this.raycaster.intersectObjects(this.mainObject.children);
      if (this.environment.controls.state < 0 && intersects.length > 0) {
        let isLine = intersects[0].object.type === "LineSegments";
        let newIndex = isLine
          ? intersects[0].object.getEdgeMetadataAtLineIndex(intersects[0].index).localEdgeIndex
          : intersects[0].object.geometry.attributes.color.getX(intersects[0].face.a);
        if (this.highlightedObj != intersects[0].object || this.highlightedIndex !== newIndex) {
          if (this.highlightedObj) {
            this.highlightedObj.material.color.setHex(this.highlightedObj.currentHex);
            if (this.highlightedObj && this.highlightedObj.clearHighlights) {
              this.highlightedObj.clearHighlights();
            }
          }
          this.highlightedObj = intersects[0].object;
          this.highlightedObj.currentHex = this.highlightedObj.material.color.getHex();
          this.highlightedObj.material.color.setHex(0xffffff);
          this.highlightedIndex = newIndex;
          if (isLine) { this.highlightedObj.highlightEdgeAtLineIndex(intersects[0].index); }
          this.environment.viewDirty = true;
        }

        let indexHelper = (isLine ? "Edge" : "Face") + " Index: " + this.highlightedIndex;
        this.goldenContainer.element.title = indexHelper;
      } else {
        if (this.highlightedObj) {
          this.highlightedObj.material.color.setHex(this.highlightedObj.currentHex);
          if (this.highlightedObj.clearHighlights) { this.highlightedObj.clearHighlights(); }
          this.environment.viewDirty = true;
        }
        this.highlightedObj = null;
        this.goldenContainer.element.title = "";
      }
    }

    if (this.handles && this.handles.length > 0) {
      for (let i = 0; i < this.handles.length; i++) {
        this.environment.viewDirty = this.handles[i].dragging || this.environment.viewDirty;
      }
    }

    // Only render if the view is dirty
    if (this.environment.viewDirty) {
      this.environment.renderer.render(this.environment.scene, this.environment.camera);
      this.environment.viewDirty = false;
    }
  }
}

export { Environment, CascadeEnvironment };

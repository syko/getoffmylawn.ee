import React, { RefObject } from 'react'
import * as THREE from 'three'
import { WebGLRenderer, OrthographicCamera, Scene, Points, BufferAttribute, Vector2, Clock } from 'three'
// import Stats from 'three/examples/jsm/libs/stats.module'

const CONTENTFUL_PIXEL_THRESHOLD = 6;

export type PixelData = Array<Float32Array>;
type ImageDataProps = {
  imageData: ImageData;
}

type PointerCollection = {
  mouse?: Vector2;
  [index: number]: Vector2;
}

function isTouchDevice() {
  return (('ontouchstart' in window) ||
     (navigator.maxTouchPoints > 0) ||
     ((navigator as any).msMaxTouchPoints > 0));
}

class TheInteractiveThing extends React.Component<ImageDataProps> {
  container: RefObject<HTMLDivElement>;
  windowWidth: number = 0;
  windowHeight: number = 0;
  pointers: PointerCollection = {};
  lastPointers: PointerCollection = {};
  clock: Clock;
  camera!: OrthographicCamera;
  scene!: Scene;
  renderer!: WebGLRenderer;
  stats!: {dom:HTMLElement; update: () => void};
  particles!: Points;
  originalPositions!: BufferAttribute;
  targetPositions!: BufferAttribute;
  velocities!: BufferAttribute;
  influenceRanges: Float32Array = new Float32Array(20);

  constructor(props: {imageData: ImageData}) {
    super(props);
    this.container = React.createRef();
    this.clock = new THREE.Clock();
    this.populateInfluenceRanges();
    if (!isTouchDevice()) {
      this.pointers['mouse'] = new THREE.Vector2(0, 0);
      this.lastPointers['mouse'] = new THREE.Vector2(0, 0);
    }
  }

  componentDidMount() {
    this.setupThree();

    this.createParticles();
    // this.createBackground();
    this.updateSize();

    this.addEventListeners();

    this.tick();
  }

  componentWillUnmount() {
    this.teardownThree();
    this.removeEventListeners();
  }

  populateInfluenceRanges() {
    for (let i = 0; i < this.influenceRanges.length; i++) {
      this.influenceRanges[i] = 5000 + Math.random() * 5000;
    }
  }

  getContentfulPixels(imageData: ImageData): PixelData {
    const { width, height, data } = imageData;
    const pixels: PixelData = [];
    let x, y;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] < CONTENTFUL_PIXEL_THRESHOLD) continue;
      x = (i / 4) % width;
      y = height - Math.floor((i / 4 - x) / width);
      pixels.push(new Float32Array([x, y, data[i], data[i + 1], data[i + 2]]));
    }
    return pixels;
  }

  setupThree() {
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.scene = new THREE.Scene();

    this.camera = new THREE.OrthographicCamera(0, window.innerWidth, window.innerHeight, 0, 0, 100);
    this.camera.position.z = 100;


    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.current!.appendChild(this.renderer.domElement);

    // this.stats = new (Stats as any)();
    // this.container.current!.appendChild(this.stats.dom);
  }

  teardownThree() {
    this.renderer.dispose();
  }

  createBackground() {
    const scene = this.scene;
    new THREE.TextureLoader().load('/lawn.png', (texture) => {
      const material = new THREE.SpriteMaterial({ map: texture, color: 0xffffff });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(texture.image.width, texture.image.height, 1);
      sprite.position.add(this.particles.position);
      sprite.position.setZ(1);
      scene.add(sprite);
    });
  }

  populatePositions(pixelData: PixelData): Float32Array {
    const { width, height } = this.props.imageData;
    const positions = new Float32Array(pixelData.length * 3);
    for (let i = 0; i < pixelData.length; i++) {
      let j = i * 3;
      positions[j] = pixelData[i][0] - width / 2;
      positions[j + 1] = pixelData[i][1] - height / 2;
      positions[j + 2] = 0;
    }
    this.originalPositions = new THREE.BufferAttribute(positions.slice(), 3);
    this.targetPositions = new THREE.BufferAttribute(positions.slice(), 3);
    this.velocities = new THREE.BufferAttribute(new Float32Array(positions.length), 3);
    return positions;
  }

  populateColors(pixelData: PixelData): Float32Array {
    const colors = new Float32Array(pixelData.length * 3);
    for (let i = 0; i < pixelData.length; i++) {
      let j = i * 3;
      colors[j] = pixelData[i][2] / 255;
      colors[j + 1] = pixelData[i][3] / 255;
      colors[j + 2] = pixelData[i][4] / 255;
    }
    return colors;
  }

  createParticles() {
    const pixelData = this.getContentfulPixels(this.props.imageData);

    const positions = this.populatePositions(pixelData);
    const colors = this.populateColors(pixelData);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.particles = new THREE.Points(geometry, new THREE.PointsMaterial({vertexColors: true, size: 1}));
    this.scene.add(this.particles);
  }

  addEventListeners() {
    if(!isTouchDevice()) this.container.current!.addEventListener('pointermove', this.onMouseMove);
    this.container.current!.addEventListener('touchstart', this.onTouchMove);
    this.container.current!.addEventListener('touchmove', this.onTouchMove);
    this.container.current!.addEventListener('touchend', this.onTouchEnd);
    this.container.current!.addEventListener('touchcancel', this.onTouchEnd);
    window.addEventListener('resize', this.onWindowResize);
  }

  removeEventListeners() {
    if(!isTouchDevice()) this.container.current!.removeEventListener('pointermove', this.onMouseMove);
    this.container.current!.removeEventListener('touchstart', this.onTouchMove);
    this.container.current!.removeEventListener('touchmove', this.onTouchMove);
    this.container.current!.removeEventListener('touchend', this.onTouchEnd);
    this.container.current!.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('resize', this.onWindowResize);
  }

  onWindowResize = () => {
    this.updateSize();
  }

  onMouseMove = (e: PointerEvent) => {
    if (!e.isPrimary) return;
    this.lastPointers.mouse!.set(this.pointers.mouse!.x, this.pointers.mouse!.y);
    this.pointers.mouse!.set(e.clientX, this.windowHeight - e.clientY);
  }

  ensureTouchExists(id: number, x: number, y: number) {
    if (this.pointers[id]) return;
    this.pointers[id] = new Vector2(x, y);
    this.lastPointers[id] = new Vector2(x, y);
  }

  onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const id = touch.identifier;
      this.pointers[id] = new Vector2(touch.clientX, touch.clientY);
      this.lastPointers[id] = this.pointers[id];
    }
  }

  onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const id = touch.identifier;
      this.ensureTouchExists(id, touch.clientX, this.windowHeight - touch.clientY);
      this.lastPointers[id].set(this.pointers[id].x, this.pointers[id].y);
      this.pointers[id].set(touch.clientX, this.windowHeight - touch.clientY);
    }
  }

  onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const id = e.changedTouches[i].identifier;
      delete this.pointers[id];
      delete this.lastPointers[id];
    }
  }

  updateSize() {
    const { innerWidth: w, innerHeight: h } = window;
    this.windowWidth = w;
    this.windowHeight = h;
    this.camera.top = h;
    this.camera.right = w;
    this.renderer.setSize(w, h);
    this.particles.position.set(w / 2, h / 2, 2);
    this.camera.updateProjectionMatrix();
  }

  updateParticles() {
    const positions = this.particles.geometry.attributes.position;
    const parentOffset: Vector2 = new THREE.Vector2(this.particles.position.x, this.particles.position.y);
    const tickSize = this.clock.getDelta() * 144;
    for (let k in this.pointers) {
      let x, y, tx, ty, vx, vy;
      const pointerPosAdjusted = this.pointers[k].clone().sub(parentOffset);
      const pos: Vector2 = new THREE.Vector2(0, 0);
      let particleDistance: Vector2 = new THREE.Vector2(0, 0);
      let movement: Vector2 = new THREE.Vector2(0, 0);
      // Update targePositions
      for (let i = 0; i < positions.count; i++) {
        pos.set(positions.getX(i), positions.getY(i));
        particleDistance = pointerPosAdjusted.clone().sub(pos);
        if (particleDistance.lengthSq() < this.influenceRanges[i % this.influenceRanges.length]) {
          movement = particleDistance.clone().normalize().multiplyScalar(0 + Math.random() * 165 - particleDistance.length());
          this.targetPositions.setXY(i, pos.x - movement.x, pos.y - movement.y);
        } else this.targetPositions.setXY(i, this.originalPositions.getX(i), this.originalPositions.getY(i));
      }
      // Update velocities based on target positions and current velocities and update positions
      for (let i = 0; i < positions.count; i++) {
        x = positions.getX(i);
        y = positions.getY(i);
        vx = this.velocities.getX(i);
        vy = this.velocities.getY(i);
        tx = this.targetPositions.getX(i);
        ty = this.targetPositions.getY(i);
        vx = (vx + (tx - x) * 0.02) * 0.89;
        vy = (vy + (ty - y) * 0.02) * 0.89;
        this.velocities.setXY(i, vx, vy);
        positions.setXY(i, x + vx * tickSize, y + vy * tickSize);
      }
    }
  }

  tick = () => {
    requestAnimationFrame(this.tick);
    this.renderThree();
    if(this.stats) this.stats.update();
  }

  renderThree() {
    this.updateParticles();
    this.particles.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  render() {
    return (
      <div ref={this.container} />
    )
  }
}

export default TheInteractiveThing;
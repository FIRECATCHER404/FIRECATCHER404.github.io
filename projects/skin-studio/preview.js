/* Uses the locally bundled skinview3d. No CDN, account, or remote skin requests. */
(function (root) {
  'use strict';
  class PlayerPreview {
    constructor(canvas, stage) {
      this.canvas = canvas;
      this.stage = stage;
      this.currentImage = null;
      this.model = null;
      this.rotating = false;
      this.available = false;
      this.active = false;
      this.lastTime = performance.now();
      try {
        this.viewer = new skinview3d.SkinViewer({canvas, width:400, height:398, renderPaused:true, zoom:.78, pixelRatio:Math.min(devicePixelRatio || 1, 2)});
        this.viewer.controls.enablePan = false;
        this.viewer.controls.enableDamping = true;
        this.viewer.controls.dampingFactor = .12;
        this.viewer.controls.minDistance = 25;
        this.viewer.controls.maxDistance = 110;
        this.viewer.globalLight.intensity = 2.2;
        this.viewer.cameraLight.intensity = .75;
        this.available = true;
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(stage);
        this.setView('3d');
        canvas.addEventListener('keydown', event => {
          if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Home') this.setView('3d');
          else if (['+','=','-'].includes(event.key)) this.viewer.camera.position.multiplyScalar(event.key === '-' ? 1.1 : .9);
          else {
            if (event.key === 'ArrowLeft') this.viewer.playerObject.rotation.y -= .15;
            if (event.key === 'ArrowRight') this.viewer.playerObject.rotation.y += .15;
            if (event.key === 'ArrowUp') this.viewer.camera.position.y = Math.min(50,this.viewer.camera.position.y + 3);
            if (event.key === 'ArrowDown') this.viewer.camera.position.y = Math.max(-40,this.viewer.camera.position.y - 3);
          }
        });
      } catch (error) {
        this.viewer?.dispose();
        const message = document.getElementById('previewError');
        message.textContent = '3D preview needs WebGL. The skin map is still available; enable hardware acceleration in your browser to use 3D.';
        message.hidden = false;
      }
    }
    resize() {
      if (!this.available) return;
      const {width,height} = this.stage.getBoundingClientRect();
      if (width > 0 && height > 0 && (this.viewer.width !== Math.round(width) || this.viewer.height !== Math.round(height)))
        this.viewer.setSize(Math.round(width), Math.round(height));
    }
    setActive(active) {
      this.active = !!active && this.available;
      if (this.viewer) this.viewer.controls.enabled = this.active;
    }
    setView(view) {
      if (!this.available) return;
      this.viewer.controls.reset();
      this.viewer.playerObject.rotation.set(0,0,0);
      this.viewer.playerWrapper.rotation.set(0,0,0);
      if (view === 'front') this.viewer.camera.position.set(0,0,55);
      else if (view === 'back') this.viewer.camera.position.set(0,0,-55);
      else this.viewer.camera.position.set(25,10,48);
      this.viewer.controls.target.set(0,0,0);
      this.viewer.controls.update();
    }
    setOuterLayer(visible) {
      if (!this.available) return;
      for (const part of ['head','body','leftArm','rightArm','leftLeg','rightLeg'])
        this.viewer.playerObject.skin[part].outerLayer.visible = visible;
    }
    show(image, model) {
      if (!this.available || !this.active) return;
      this.resize();
      if (!image?.complete || !image.naturalWidth) {
        if (this.currentImage) this.viewer.loadSkin(null);
        this.currentImage = null;
      } else if (image !== this.currentImage || model !== this.model) {
        this.viewer.loadSkin(image, {model:model === 'wide' ? 'default' : model === 'slim' ? 'slim' : 'auto-detect'});
        this.currentImage = image;
        this.model = model;
      }
      document.getElementById('previewModel').textContent = `${this.viewer.playerObject.skin.modelType === 'slim' ? 'SLIM' : 'WIDE'} ARMS · 64 × 64`;
      const now = performance.now();
      if (this.rotating) this.viewer.playerObject.rotation.y += Math.min((now-this.lastTime)/1000,.05) * .45;
      this.lastTime = now;
      this.viewer.controls.update();
      this.viewer.render();
    }
    dispose() { this.resizeObserver?.disconnect(); this.viewer?.dispose(); }
    state() {
      return {available:this.available, active:this.active, model:this.viewer?.playerObject.skin.modelType,
        camera:this.viewer?.camera.position.toArray(), rotation:this.viewer?.playerObject.rotation.y,
        width:this.viewer?.width, height:this.viewer?.height, hasTexture:!!this.currentImage};
    }
  }
  root.ExpressionfulPlayerPreview = PlayerPreview;
})(globalThis);

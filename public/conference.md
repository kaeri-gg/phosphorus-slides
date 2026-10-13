<!-- 
  LLM INSTRUCTION: 
  - Only create or modify ONE page at a time as requested by the user.
  - Do NOT generate multiple forward placeholder pages in advance.
  - Maintain the existing structure and settings.
  - ALWAYS use tabs instead of multiple spaces for indentation.
  - ALWAYS author content in English.
  - SECTION TRANSITIONS: When transitioning between roadmap milestones, use a step with `layout="center"` containing `<title>` and `<subtitle>` centered on the page.
-->

<!-- Global Presentation Settings -->
<setting name="resolution" width="1500" height="1024"></setting>
<setting name="transition" value="1.5s"></setting>
<setting name="node-animation" value="0.55s"></setting>
<setting name="node-stagger" value="70ms"></setting>
<setting name="edge-animation" value="1.50s"></setting>
<setting name="edge-delay" value="0.38s"></setting>
<setting name="pulse-speed" value="2200ms"></setting>
<setting name="timer" value="20m"></setting>

<step id="welcome-logo" layout="center">
<image src="assets/icon.svg" color="white"></image>
</step>

<step id="speakers" layout="profile">
<title>Speakers</title>

<profile 
	name="sunag" 
	nickname="Jean Carlo Deconto" 
	role="TSL - WebGPURenderer"
	avatar="assets/me.jpg">
</profile>
Evolving Three.js for the WebGPU era.
</step>

<step id="welcome-title" layout="center">
<title id="title-main">TSL</title>

	<step id="welcome-title-stands">
	<title id="title-main" stands="TSL">Three.js Shading Language</title>
	<subtitle delay="1.8s">An Approach to Productive and Maintainable Shader Creation</subtitle>
	</step>
</step>

<step id="tsl-intro" size="large" width="wide" background="assets/fire.mp4" perspective="true">
<title>What is TSL?</title>

**TSL (Three.js Shading Language)** is the new shader standard for `WebGPURenderer`, enabling node-based graphics and compute written directly in **JavaScript**.
</step>

<step id="example-title" layout="center">
<title>Creating a Detail Map</title>
<subtitle>GLSL String Injection vs TSL Node Composition</subtitle>
</step>

<step id="detailmap-comparison" layout="code-compare" size="large">
<title>Creating a Detail Map</title>
<subtitle>GLSL String Injection vs TSL Node Composition</subtitle>

<code file="WebGLRenderer - GLSL" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three';

const material = new THREE.MeshStandardMaterial( {
	map: map
} );

material.onBeforeCompile = ( shader ) => {

	shader.uniforms.detailMap = { value: detailMap };

	shader.fragmentShader = `
		uniform sampler2D detailMap;
	` + shader.fragmentShader;

	shader.fragmentShader = shader.fragmentShader.replace(
		'#include <map_fragment>',
		`
		#include <map_fragment>
		vec4 detail = texture2D( detailMap, vMapUv * vec2( 10.0, 10.0 ) );
		diffuseColor.rgb = detail.rgb * 2.0;
		`
	);

};
</code>

<code file="WebGPURenderer - TSL" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { texture, uv, vec2 } from 'three/tsl';

const material = new THREE.MeshStandardNodeMaterial();

const detailUV = uv().mul( vec2( 10, 10 ) );
const detail = texture( detailMap, detailUV );

// Direct node composition with native WebGPU / WebGL support
material.colorNode = texture( map ).mul( detail.rgb ).mul( 2.0 );
</code>
</step>

<step id="tsl-roadmap-gaussian" layout="center">
<title>Breaking down Gaussian blur</title>
<subtitle>Understanding TSL Architecture Through a Node</subtitle>
</step>

<step id="gaussian-blur-example" layout="code-compare" size="large">
<title>Breaking down Gaussian blur</title>
<subtitle>Understanding TSL Architecture Through a Node</subtitle>

<code file="gaussianBlur.js" lang="javascript" typewriter="true" speed="fast">
const scenePass = pass( scene, camera );

const scenePassBlurred = gaussianBlur(
	scenePass, // input pass texture
	scattering, // direction and spread vector
	4, // sample kernel radius
	{ resolutionScale: 0.5 } // downsample to 50% for performance
);

// Composite original scene with blurred scattering
const compositeNode = mix(
	scenePass, // original crisp scene pass
	scenePassBlurred, // blurred pass result
	fogFactor // interpolation factor (depth / fog)
);

renderPipeline.outputNode = compositeNode;
</code>

<video id="v-gaussian-blur" src="assets/gaussian-blur.mp4" name="Gaussian Blur" width="1200" height="1000" highlight="true"></video>

<edge from="gaussianBlur.js" to="Gaussian Blur"></edge>

	<step id="gaussian-blur-expanded">
	<code visible="false"></code>
	<video id="v-gaussian-blur" zoom="100%" origin="top,center"></video>

	<step id="gaussian-blur-zoom">
	<video id="v-gaussian-blur" zoom="150%" origin="bottom,left"></video>
	</step>

	<step id="gaussian-blur-zoom">
	<video id="v-gaussian-blur" zoom="150%" origin="bottom,right"></video>
	</step>

	<step id="gaussian-blur-zoom">
	<video id="v-gaussian-blur" zoom="100%" origin="bottom,center"></video>
	</step>

	</step>
</step>

<step id="gaussian-blur-build" size="large">
<title>Gaussian Blur</title>
<subtitle>A simplified overview</subtitle>

<item>Interface</item>
<item>setup</item>
<item>updateBefore</item>
<item>Anywhere</item>

	<step id="gb-interface" active="1">
	Extends `TempNode` to manage render targets, input parameters, and per-frame update lifecycle.

	<code file="GaussianBlurNode.js" lang="javascript" typewriter="true" speed="fast">
import { TempNode } from 'three/webgpu';

export class GaussianBlurNode extends TempNode {

	constructor( textureNode, directionNode = null, sigma = 4 ) { ... }

	setup( builder ) { ... }

	updateBefore( frame ) { ... }

}
	</code>
	</step>

	<step id="gb-interface-tsl" active="1">
	Exposes a chainable, native TSL functional component.

	<code file="GaussianBlurNode.js" lang="javascript" typewriter="true" speed="fast" incremental="true">
import { TempNode } from 'three/webgpu';

export class GaussianBlurNode extends TempNode {

	constructor( textureNode, directionNode = null, sigma = 4 ) { ... }

	setup( builder ) { ... }

	updateBefore( frame ) { ... }

}

// Export as a native TSL Component
export const gaussianBlur = ( node, direction, sigma, options ) =>
	new GaussianBlurNode( node, direction, sigma, options );
	</code>
	</step>

	<step id="gb-setup-fn" active="2">
	Configures procedural blur convolution via `Fn()`.

	<code file="GaussianBlurNode.js" lang="javascript" typewriter="true" speed="fast">
// class GaussianBlurNode extends TempNode { ...

	setup( builder ) {

		const blur = Fn( ( [ textureNode, passDirection ] ) => {

			// Convolute samples across gaussian kernel
			...

		} );
	</code>
	</step>

	<step id="gb-setup-materials" active="2">
	Instantiates the horizontal and vertical `NodeMaterial` and returns the output node.

	<code file="GaussianBlurNode.js" lang="javascript" typewriter="true" speed="fast" incremental="true">
// class GaussianBlurNode extends TempNode { ...

	setup( builder ) {

		const blur = Fn( ( [ textureNode, passDirection ] ) => {

			// Convolute samples across gaussian kernel
			...

		} );

		// Horizontal Blur Material
		this._hMaterial = new NodeMaterial();
		this._hMaterial.fragmentNode = blur( this.textureNode, vec2( 1, 0 ) );

		// Vertical Blur Material
		this._vMaterial = new NodeMaterial();
		this._vMaterial.fragmentNode = blur( texture( this._horizontalRT.texture ), vec2( 0, 1 ) );

	}
	</code>
	</step>

	<step id="gb-update" active="3">
	Performs dual-pass rendering horizontal and vertical `RenderTarget` passes once per frame.

	<code file="GaussianBlurNode.js" lang="javascript" typewriter="true" speed="fast">
// class GaussianBlurNode extends TempNode { ...

	updateBefore( frame ) {

		const { renderer } = frame;

		// Pass 1: Horizontal Blur Pass
		_quadMesh.material = this._hMaterial;
		renderer.setRenderTarget( this._horizontalRT );
		_quadMesh.render( renderer );

		// Pass 2: Vertical Blur Pass
		_quadMesh.material = this._vMaterial;
		renderer.setRenderTarget( this._verticalRT );
		_quadMesh.render( renderer );

	}
	</code>
	</step>

	<step id="gb-anywhere" active="4">
	Write once, run anywhere across any pipeline stages — seamlessly shared across materials, particles, post-processing, and compute shaders.

	<code file="anywhere.js" lang="javascript" typewriter="true" speed="fast">
import { pass, texture } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';

// 1. Post-Processing Stage
postProcessing.outputNode = gaussianBlur( pass( scene, camera ) );

// 2. Material Stage
material.colorNode = gaussianBlur( texture( map ) );
	</code>
	</step>
</step>

<step id="node-orbit-intro" size="large">
<title>Node Architecture</title>
<subtitle>Let's talk about the architecture.</subtitle>

	<step id="node-orbit-center">
	<circle id="c-node" name="Node" icon="fa-cube" x="50" y="50" color="#38bdf8" orbit="true"></circle>
	</step>

	<step id="node-orbit-gaussian">
	Complex routines and effects like `gaussianBlur()` are nodes.

	<circle id="c-gaussian" name="gaussianBlur" icon="fa-wand-magic-sparkles" x="50" y="18" color="#ec4899"></circle>
	<edge from="c-node" to="c-gaussian"></edge>
	</step>

	<step id="node-orbit-float">
	Fundamental scalar data types like `float()` are nodes.

	<circle id="c-float" name="float" icon="1.0" x="80" y="40" color="#34d399"></circle>
	<edge from="c-node" to="c-float"></edge>
	</step>

	<step id="node-orbit-vec3">
	Vector math primitives like `vec3()` are nodes.

	<circle id="c-vec3" name="vec3" icon="xyz" x="69" y="76" color="#c084fc"></circle>
	<edge from="c-node" to="c-vec3"></edge>
	</step>

	<step id="node-orbit-uniform">
	Dynamic GPU inputs like `uniform()` are nodes.

	<circle id="c-uniform" name="uniform" icon="fa-sliders" x="31" y="76" color="#f59e0b"></circle>
	<edge from="c-node" to="c-uniform"></edge>
	</step>

	<step id="node-orbit-attribute">
	Accessing geometry data through `attribute()` are nodes.

	<circle id="c-attribute" name="attribute" icon="fa-database" x="20" y="40" color="#38bdf8"></circle>
	<edge from="c-node" to="c-attribute"></edge>
	</step>

	<step id="node-consumer-material" reset="true">
	Materials consume TSL nodes for custom surface shading, lighting, and vertex displacement.

	<group name="TSL Nodes" color="#38bdf8" nodes="n-position, n-normal, n-custom-node"></group>
	<group name="Project" color="#c084fc" nodes="t-material"></group>

	<node id="n-position" name="position" description="positionView" icon="fa-location-dot" x="20" y="16" color="#38bdf8"></node>
	<node id="n-normal" name="normal" description="normalView" icon="fa-compass" x="50" y="16" color="#34d399"></node>
	<node id="n-custom-node" name="myCustomNode" description="Uniforms + Math Operations" icon="fa-puzzle-piece" x="80" y="16" color="#f59e0b"></node>

	<node id="t-material" name="Material" icon="fa-palette" x="20" y="52" color="#ec4899" highlight="true"></node>

	<edge from="n-position" to="t-material" from-port="bottom" to-port="top"></edge>
	<edge from="n-normal" to="t-material" from-port="bottom" to-port="top"></edge>
	<edge from="n-custom-node" to="t-material" from-port="bottom" to-port="top"></edge>
	</step>

	<step id="node-consumer-scene">
	`Scene` nodes manage background, fog, and environment reflections powered by nodes.

	<group name="Project" nodes="t-material, t-scene"></group>

	<node id="t-scene" name="Scene" description="Background Fog Environment" icon="fa-mountain-sun" x="50" y="52" color="#a855f7" highlight="true"></node>

	<edge from="n-position" to="t-scene" from-port="bottom" to-port="top"></edge>
	<edge from="n-normal" to="t-scene" from-port="bottom" to-port="top"></edge>
	</step>

	<step id="node-consumer-mrt">
	`MRT` (Multiple Render Targets) outputs multiple data buffers like normals in a single render pass.

	<group name="Project" nodes="t-material, t-scene, t-mrt"></group>

	<node id="t-mrt" name="MRT" description="Multiple Render Targets" icon="fa-layer-group" x="80" y="52" color="#06b6d4" highlight="true"></node>

	<edge from="n-normal" to="t-mrt" from-port="bottom" to-port="top"></edge>
	</step>

	<step id="node-consumer-postprocessing">
	Post-Processing applies screen-space shaders, bloom, and multi-pass effects directly using custom nodes.

	<group name="Project" nodes="t-material, t-scene, t-mrt, t-postprocessing"></group>

	<node id="t-postprocessing" name="Post-Processing" icon="fa-wand-magic-sparkles" x="20" y="84" color="#818cf8" highlight="true"></node>

	<edge from="n-position" to="t-postprocessing" from-port="bottom" to-port="top"></edge>
	<edge from="n-normal" to="t-postprocessing" from-port="bottom" to-port="top"></edge>
	<edge from="n-custom-node" to="t-postprocessing" from-port="bottom" to-port="top"></edge>
	<edge from="t-mrt" to="t-postprocessing" from-port="bottom" to-port="top"></edge>
	</step>

	<step id="node-consumer-particles">
	Particle systems simulate millions of GPU instances with positions, velocities, and normal-aligned vectors.

	<group name="Project" nodes="t-material, t-scene, t-mrt, t-postprocessing, t-particles"></group>

	<node id="t-particles" name="Particles" icon="fa-atom" x="50" y="84" color="#10b981" highlight="true"></node>

	<edge from="n-position" to="t-particles" from-port="bottom" to-port="top"></edge>
	</step>

	<step id="node-consumer-compute">
	Compute shaders execute parallel GPU operations, physics simulations, and data transformations.

	<group name="Project" nodes="t-material, t-scene, t-mrt, t-postprocessing, t-particles, t-compute"></group>

	<node id="t-compute" name="Compute" icon="fa-server" x="80" y="84" color="#f43f5e" highlight="true"></node>

	<edge from="n-custom-node" to="t-compute" from-port="bottom" to-port="top"></edge>
	</step>

	<step id="node-consumer-ecosystem">
	Nodes and GPU buffers, such as uniforms, are seamlessly shared across materials, scene environments, MRT, post-processing, and compute pipelines.
	</step>
</step>

<step id="tsl-roadmap-syntax" layout="center">
<title>TSL Function</title>
<subtitle>Compiling JavaScript Functions into GPU with `Fn()`</subtitle>
</step>

<step id="tsl-function" layout="code-compare" size="large">
<title>TSL Function</title>
<subtitle>Compiling JavaScript Functions into GPU with `Fn()`</subtitle>

	<step id="tsl-fn-declaration">
	Compiling pure JavaScript functions into GPU instructions via `Fn()`.

	<code file="displaceSurface.js" lang="javascript" typewriter="true" speed="fast">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 } ) => {

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );
	</code>
	</step>

	<step id="tsl-fn-named">
	Calling the function with named object parameters.

	<code file="displaceSurface.js" lang="javascript" typewriter="true" speed="fast" incremental="true">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 } ) => {

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );

// Calling the function with named parameters
const displaced = displaceSurface( { position: positionLocal, intensity: 0.15 } );
	</code>
	</step>

	<step id="tsl-fn-remove-named">
	Seamlessly switch between named and positional parameter signatures.

	<code file="displaceSurface.js" lang="javascript" typewriter="true" speed="fast" decrement="true">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 } ) => {

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );
	</code>
	</step>

	<step id="tsl-fn-positional">
	Or call directly with positional arguments.

	<code file="displaceSurface.js" lang="javascript" typewriter="true" speed="fast" incremental="true">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 } ) => {

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );

// Calling the function with positional parameters
const displaced = displaceSurface( positionLocal, 0.15 );
	</code>
	</step>

	<step id="tsl-fn-material">
	Apply displaced geometry and dynamic colors directly to the material.

	<code file="displaceSurface.js" lang="javascript" typewriter="true" speed="fast" incremental="true">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 } ) => {

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );

// Calling the function with positional parameters
const displaced = displaceSurface( positionLocal, 0.15 );

// Apply displaced geometry and dynamic color
material.positionNode = displaced;
material.colorNode = mix( color( 0x0055ff ), color( 0x00ffcc ), displaced.y.add( 0.5 ) );
	</code>
	</step>

	<step id="tsl-fn-builder-param">
	TSL functions can receive the builder context as their second argument.

	<code file="displaceSurface.js" lang="javascript" typewriter="true" speed="fast" incremental="true">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 }, builder ) => {

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );

// Calling the function with positional parameters
const displaced = displaceSurface( positionLocal, 0.15 );

// Apply displaced geometry and dynamic color
material.positionNode = displaced;
material.colorNode = mix( color( 0x0055ff ), color( 0x00ffcc ), displaced.y.add( 0.5 ) );
	</code>
	</step>

	<step id="tsl-fn-builder-destructure">
	Access active renderer, material, geometry, scene, and object directly from the builder.

	<code file="displaceSurface.js" lang="javascript" typewriter="true" speed="fast" incremental="true">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 }, builder ) => {

	const {
		renderer, // THREE.WebGPURenderer
		material, // THREE.NodeMaterial
		geometry, // THREE.BufferGeometry
		scene, // THREE.Scene
		object // THREE.Object3D
	} = builder;

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );

// Calling the function with positional parameters
const displaced = displaceSurface( positionLocal, 0.15 );

// Apply displaced geometry and dynamic color
material.positionNode = displaced;
material.colorNode = mix( color( 0x0055ff ), color( 0x00ffcc ), displaced.y.add( 0.5 ) );
	</code>
	</step>

	<step id="tsl-fn-builder-focus">
	Inspecting runtime context parameters directly inside your shader functions.

	<code file="displaceSurface.js" lang="javascript" focus="builder, 6-12">
import { Fn, positionLocal, time, sin, vec3, color, mix } from 'three/tsl';

// Function declaration with destructured defaults
const displaceSurface = Fn( ( { position = positionLocal, intensity = 0.15 }, builder ) => {

	const {
		renderer, // THREE.WebGPURenderer
		material, // THREE.NodeMaterial
		geometry, // THREE.BufferGeometry
		scene, // THREE.Scene
		object // THREE.Object3D
	} = builder;

	const wave = sin( position.xz.mul( 4.0 ).add( time ) );
	const elevation = wave.x.add( wave.y ).mul( intensity );

	return position.add( vec3( 0.0, elevation, 0.0 ) );

} );

// Calling the function with positional parameters
const displaced = displaceSurface( positionLocal, 0.15 );

// Apply displaced geometry and dynamic color
material.positionNode = displaced;
material.colorNode = mix( color( 0x0055ff ), color( 0x00ffcc ), displaced.y.add( 0.5 ) );
	</code>
	</step>
</step>

<step id="tsl-events" layout="code-compare" size="large">
<title>Events</title>
<subtitle>Automating CPU updates directly across GPU render lifecycles</subtitle>

	<step id="tsl-events-code">
	Automating CPU updates directly across GPU render lifecycles.

	<code file="pulsingMaterial.js" lang="javascript" typewriter="true" speed="fast">
import { uniform, Fn, OnMaterialUpdate, color } from 'three/tsl';

// Self-contained shader with embedded CPU lifecycle updates
const pulseEffect = Fn( () => {

	const dynamicColor = uniform( color( 0x0055ff ) );

	// Execute CPU logic automatically when the material renders
	OnMaterialUpdate( ( { time } ) => {

		dynamicColor.value.setHSL( ( time * 0.1 ) % 1.0, 0.9, 0.5 );

	} );

	return dynamicColor;

} );

// Assign to material — CPU callback runs automatically with zero manual animation loops
material.colorNode = pulseEffect();
	</code>
	</step>

	<step id="tsl-events-focus">
	Automatic CPU-to-GPU synchronization executed at material render time.

	<code file="pulsingMaterial.js" lang="javascript" typewriter="true" speed="fast" focus="OnMaterialUpdate, 6, 8-13">
import { uniform, Fn, OnMaterialUpdate, color } from 'three/tsl';

// Self-contained shader with embedded CPU lifecycle updates
const pulseEffect = Fn( () => {

	const dynamicColor = uniform( color( 0x0055ff ) );

	// Execute CPU logic automatically when the material renders
	OnMaterialUpdate( ( { time } ) => {

		dynamicColor.value.setHSL( ( time * 0.1 ) % 1.0, 0.9, 0.5 );

	} );

	return dynamicColor;

} );

// Assign to material — CPU callback runs automatically with zero manual animation loops
material.colorNode = pulseEffect();
	</code>
	</step>
</step>

<step id="unified-flow" layout="code-compare" size="large">
<title>Unified Flow</title>
<subtitle>Cross-stage composition with `.toVertexStage()`</subtitle>

	<step id="unified-flow-code">
	Shader logic assigned to material outputs evaluates in the fragment stage by default.

	<code file="waveShader.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { uv, time, sin, positionLocal, normalWorld } from 'three/tsl';

const material = new THREE.NodeMaterial();

const wave = sin( uv().mul( 10.0 ).add( time ) );

material.colorNode = wave;
	</code>

	<code file="wave.vertex.wgsl" lang="wgsl" typewriter="true" speed="fast">
struct VaryingsStruct {
	@builtin( position ) builtinClipSpace : vec4<f32>,
	@location( 0 ) uv : vec2<f32>
};

@vertex
fn main( @location( 0 ) position : vec3<f32>, @location( 1 ) uv : vec2<f32>, @location( 2 ) normal : vec3<f32> ) -> VaryingsStruct {

	var positionLocal = position;

	varyings.builtinClipSpace = render.projectionMatrix * render.viewMatrix * vec4<f32>( positionLocal, 1.0 );
	varyings.uv = uv;

	return varyings;

}
	</code>

	<code file="wave.fragment.wgsl" lang="wgsl" typewriter="true" speed="fast">
struct OutputStruct {
	@location( 0 ) color : vec4<f32>
};

@fragment
fn main( @location( 0 ) uv : vec2<f32> ) -> OutputStruct {

	let wave = sin( ( ( uv * vec2<f32>( 10.0 ) ) + vec2<f32>( render.time ) ) );
	output.color = vec4<f32>( wave, 0.0, 1.0 );

	return output;

}
	</code>
	</step>

	<step id="unified-flow-vertex">
	Automatically moves computation to the vertex shader and interpolates it to the fragment stage as a varying with `.toVertexStage()`.

	<code file="waveShader.js" lang="javascript" typewriter="true" speed="fast" focus=".toVertexStage()">
import * as THREE from 'three/webgpu';
import { uv, time, sin, positionLocal, normalWorld } from 'three/tsl';

const material = new THREE.NodeMaterial();

const wave = sin( uv().mul( 10.0 ).add( time ) ).toVertexStage();

material.colorNode = wave;
	</code>

	<code file="wave.vertex.wgsl" lang="wgsl" typewriter="true" speed="fast">
struct VaryingsStruct {
	@builtin( position ) builtinClipSpace : vec4<f32>,
	@location( 0 ) wave : vec2<f32>
};

@vertex
fn main( @location( 0 ) position : vec3<f32>, @location( 1 ) uv : vec2<f32>, @location( 2 ) normal : vec3<f32> ) -> VaryingsStruct {

	let wave = sin( ( ( uv * vec2<f32>( 10.0 ) ) + vec2<f32>( render.time ) ) );

	var positionLocal = position;

	varyings.builtinClipSpace = render.projectionMatrix * render.viewMatrix * vec4<f32>( positionLocal, 1.0 );
	varyings.wave = wave;

	return varyings;

}
	</code>

	<code file="wave.fragment.wgsl" lang="wgsl" typewriter="true" speed="fast">
struct OutputStruct {
	@location( 0 ) color : vec4<f32>
};

@fragment
fn main( @location( 0 ) wave : vec2<f32> ) -> OutputStruct {

	output.color = vec4<f32>( wave, 0.0, 1.0 );

	return output;

}
	</code>
	</step>

	<step id="unified-flow-position">
	Using the same wave expression to deform vertex positions and drive fragment color simultaneously.

	<code file="waveShader.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { uv, time, sin, positionLocal, normalWorld } from 'three/tsl';

const material = new THREE.NodeMaterial();

const wave = sin( uv().mul( 10.0 ).add( time ) ).toVertexStage();

material.colorNode = wave;

material.positionNode = positionLocal.add( normalWorld.mul( wave ) );
	</code>

	<code file="wave.vertex.wgsl" lang="wgsl" typewriter="true" speed="fast">
struct VaryingsStruct {
	@builtin( position ) builtinClipSpace : vec4<f32>,
	@location( 0 ) wave : vec2<f32>
};

@vertex
fn main( @location( 0 ) position : vec3<f32>, @location( 1 ) uv : vec2<f32>, @location( 2 ) normal : vec3<f32> ) -> VaryingsStruct {

	let wave = sin( ( ( uv * vec2<f32>( 10.0 ) ) + vec2<f32>( render.time ) ) );

	var positionLocal = position;
	let normalView = normalize( render.modelNormalMatrix * normal );
	let normalWorld = normalize( ( vec4<f32>( normalView, 0.0 ) * render.cameraViewMatrix ).xyz );
	positionLocal = position + ( normalWorld * wave.x );

	varyings.builtinClipSpace = render.projectionMatrix * render.viewMatrix * vec4<f32>( positionLocal, 1.0 );
	varyings.wave = wave;

	return varyings;

}
	</code>

	<code file="wave.fragment.wgsl" lang="wgsl" typewriter="true" speed="fast">
struct OutputStruct {
	@location( 0 ) color : vec4<f32>
};

@fragment
fn main( @location( 0 ) wave : vec2<f32> ) -> OutputStruct {

	output.color = vec4<f32>( wave, 0.0, 1.0 );

	return output;

}
	</code>
	</step>
</step>

<step id="compute-return-value" layout="code-compare" size="large">
<title>Compute to Material</title>
<subtitle>Driving Material Nodes Directly with GPU Compute Shaders</subtitle>

<code file="computePoints.js" lang="javascript" typewriter="true" speed="fast">
// Compute shader deforming vertices and returning current position
const computePoints = Fn( () => {

	// ...
	// Returns the compute result and expression directly to the material
	return pointPosition.element( instanceIndex );

} )().compute( countOfPoints );

// Apply computed positions directly to material
material.positionNode = computePoints;
</code>

<video src="assets/videos/webgpu_skinning_points.mp4" name="GPU Compute Output" highlight="true"></video>

<edge from="computePoints.js" to="GPU Compute Output" label="Position"></edge>
</step>

<step id="lighting-clustered" layout="code-compare" size="large">
<title>Lighting</title>
<subtitle>Forward+ Clustered Lighting System</subtitle>

<code file="clusteredLighting.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';

// 1. Enable Forward+ Clustered Lighting system
renderer.lighting = new ClusteredLighting();

// 2. Add hundreds of dynamic lights with GPU compute culling
for ( let i = 0; i < 500; i ++ ) {

	const light = new THREE.PointLight( 0x00aaff, 1, 10 );
	light.position.set( Math.random() * 40 - 20, 2, Math.random() * 40 - 20 );
	scene.add( light );

}
</code>

<video src="assets/videos/webgpu_lights_clustered.mp4" name="Clustered Lighting" highlight="true"></video>

<edge from="clusteredLighting.js" to="Clustered Lighting"></edge>
</step>

<step id="lights-color-node" layout="code-compare" size="large">
<title>Lights</title>
<subtitle>Procedural Light Shaders with `light.colorNode`</subtitle>

<code file="projectorLight.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { Fn, mx_worley_noise_float, color, time } from 'three/tsl';

// 1. Create a ProjectorLight for dynamic light projection
const projectorLight = new THREE.ProjectorLight( 0xffffff, 100 );
projectorLight.position.set( 0, 5, 0 );
scene.add( projectorLight );

// 2. Project procedural caustics using TSL Worley noise
projectorLight.colorNode = Fn( ( [ projectorUV ] ) => {

	const waterUV = projectorUV.mul( 10 ).add( time );
	const waterLayer0 = mx_worley_noise_float( waterUV ).pow( 2 );

	const caustic = waterLayer0.mul( color( 0x5abcd8 ) ).mul( 2 );

	return caustic;

} );
</code>

<video src="assets/videos/webgpu_lights_projector.mp4" name="Projector Light" highlight="true"></video>

<edge from="projectorLight.js" to="Projector Light"></edge>
</step>

<step id="shadows-transmitted" layout="code-compare" size="large">
<title>Shadows</title>
<subtitle>Transmitted and Colored Shadows via `renderer.shadowMap.transmitted`</subtitle>

<code file="transmittedShadows.js" lang="javascript" typewriter="true" speed="fast">
import { color, vec4 } from 'three/tsl';

// 1. Enable colored translucent shadow maps
renderer.shadowMap.enabled = true;
renderer.shadowMap.transmitted = true;

// 2. Define colored shadow and opacity
const shadowColor = color( 0xff0000 );
const shadowOpacity = 0.7;

material.castShadowNode = vec4( shadowColor, shadowOpacity );
</code>

<video src="assets/videos/webgpu_shadowmap_opacity.mp4" name="Transmitted Shadows" highlight="true"></video>

<edge from="transmittedShadows.js" to="Transmitted Shadows"></edge>
</step>

<step id="caustics" layout="code-compare" size="large">
<title>Caustics</title>
<subtitle>Real-time GPU Caustics and Refraction via HDR Shadow Maps</subtitle>

<code file="realtimeCaustics.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { Fn, refract, positionViewDirection, normalView, div } from 'three/tsl';

// 1. Enable HDR shadow maps for high-intensity light caustics
renderer.shadowMap.transmitted = true;
spotLight.shadow.mapType = THREE.HalfFloatType;

// 2. Compute refractive caustics directly in shadow map pass
material.castShadowNode = Fn( () => {

	const refractionVector = refract( positionViewDirection.negate(), normalView, div( 1.0, duck.material.ior ) ).normalize();
	const viewZ = normalView.z.pow( causticOcclusion );

	// ...

	return causticProjection.mul( viewZ.mul( 60 ) ).add( viewZ ).mul( causticColor );

} )();
</code>

<video src="assets/videos/webgpu_volume_caustics.mp4" name="Real-time Caustics" highlight="true"></video>

<edge from="realtimeCaustics.js" to="Real-time Caustics"></edge>
</step>

<step id="backdrop" layout="code-compare" size="large">
<title>Backdrop Color</title>
<subtitle>Access what has already been rendered with a single line `viewportSharedTexture( uv )`</subtitle>

<code file="backdropRefraction.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { viewportSharedTexture, grayscale, screenUV } from 'three/tsl';

// 1. Transparent material sampling scene behind the surface
const glassMaterial = new THREE.MeshStandardNodeMaterial();
glassMaterial.transparent = true;

// 2. Sample viewport texture
glassMaterial.backdropNode = grayscale( viewportSharedTexture( screenUV ).rgb )
</code>

<video src="assets/videos/backdrop_color.mp4" name="Backdrop Refraction" highlight="true"></video>

<edge from="backdropRefraction.js" to="Backdrop Refraction"></edge>
</step>

<step id="backdrop-depth" layout="code-compare" size="large">
<title>Backdrop Depth</title>
<subtitle>Access what has already been rendered using `viewportLinearDepth()` and `linearDepth()`</subtitle>

<code file="backdropDepth.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { viewportLinearDepth, linearDepth, cameraFar, cameraNear } from 'three/tsl';

// 1. Transparent material sampling scene behind the surface
const material = new THREE.MeshStandardNodeMaterial();
material.transparent = true;

// 2. Distance between background geometry and surface
const depth = viewportLinearDepth().sub( linearDepth() )
	.mul( cameraFar.sub( cameraNear ) );

// ...
</code>

<video src="assets/videos/backdrop_depth.mp4" name="Backdrop Depth" highlight="true"></video>

<edge from="backdropDepth.js" to="Backdrop Depth"></edge>
</step>

<step id="volumetric-area" layout="code-compare" size="large">
<title>Volumetric Area</title>
<subtitle>Real-time volumetric lighting and scattering inside 3D volumes</subtitle>

<code file="volumeLighting.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { Fn, texture3D, time, vec3, bayer16, screenCoordinate } from 'three/tsl';

// 1. Create a bounded Volume Node Material
const volumeMaterial = new THREE.VolumeNodeMaterial();
volumeMaterial.steps = 16;
volumeMaterial.offsetNode = bayer16( screenCoordinate ); // Dithering

// 2. Procedural light scattering inside the volume
volumeMaterial.scatteringNode = Fn( ( { positionRay } ) => {

	const animatedPos = positionRay.add( vec3( time.mul( 0.2 ), 0, 0 ) );
	return texture3D( noiseTexture3D, animatedPos.mul( 0.05 ) ).r;

} );

// 3. Volumetric mesh defining localized fog and light shafts
const volumeMesh = new THREE.Mesh( new THREE.BoxGeometry( 20, 10, 20 ), volumeMaterial );
volumeMesh.receiveShadow = true;
scene.add( volumeMesh );
</code>

<video src="assets/videos/webgpu_volume_fire.mp4" name="Volumetric Fire" highlight="true"></video>

<edge from="volumeLighting.js" to="Volumetric Fire"></edge>
</step>

<!-- Compute Showcase Gallery -->
<step id="compute-geometry" layout="gallery" badge="Compute">
<title>Geometry</title>

<gallery id="compute-gallery" active="0">
  <item type="video" src="assets/videos/webgpu_compute_geometry.mp4" name="Geometry"></item>
  <item type="video" src="assets/videos/webgpu_compute_particles.mp4" name="Particles"></item>
  <item type="video" src="assets/videos/webgpu_skinning_instancing.mp4" name="Instancing"></item>
  <item type="video" src="assets/videos/webgpu_compute_rasterizer.mp4" name="Rasterizer"></item>
  <item type="video" src="assets/videos/webgpu_compute_cloth.mp4" name="Simulation"></item>
</gallery>
</step>

<step id="compute-particles" layout="gallery" gallery="compute-gallery" active="1" badge="Compute">
<title>Particles</title>
</step>

<step id="compute-instancing" layout="gallery" gallery="compute-gallery" active="2" badge="Compute">
<title>Instancing</title>
</step>

<step id="compute-rasterizer" layout="gallery" gallery="compute-gallery" active="3" badge="Compute">
<title>Rasterizer</title>
</step>

<step id="compute-simulation" layout="gallery" gallery="compute-gallery" active="4" badge="Compute">
<title>Simulation</title>
</step>

<step id="mrt-title" layout="center">
<title id="title-mrt" stands="MRT">Multiple Render Targets</title>
<subtitle delay="1.8s">Simultaneous multi-buffer rendering in a single draw pass</subtitle>
</step>

<step id="mrt-compare" layout="code-compare" size="large">
<title>Multiple Render Targets</title>
<subtitle>Simultaneous multi-buffer rendering in a single draw pass</subtitle>

<code file="mrt.js" lang="javascript" typewriter="true" speed="fast">
import * as THREE from 'three/webgpu';
import { mrt, output, emissive, vec4 } from 'three/tsl';

const mrtNode = mrt( {
	output: output,
	emissive: vec4( emissive, output.a )
} );

mrtNode.setBlendMode( 
	'emissive',
	new THREE.BlendMode( THREE.NormalBlending ) 
);

const scenePass = pass( scene, camera );
scenePass.setMRT( mrtNode );

const emissivePass = scenePass.getTextureNode( 'emissive' );

const bloomPass = bloom( emissivePass, 2.5, .5 );

const renderPipeline = new THREE.RenderPipeline( renderer );
renderPipeline.outputNode = outputPass.add( bloomPass );
</code>

<video id="v-mrt" src="assets/videos/mrt.mp4" name="Multiple Render Targets" highlight="true"></video>

<edge from="mrt.js" to="Multiple Render Targets"></edge>

	<step id="mrt-focus">
	<code file="mrt.js" lang="javascript" typewriter="true" speed="fast" focus="4-15">
import * as THREE from 'three/webgpu';
import { mrt, output, emissive, vec4 } from 'three/tsl';

const mrtNode = mrt( {
	output: output,
	emissive: vec4( emissive, output.a )
} );

mrtNode.setBlendMode( 
	'emissive',
	new THREE.BlendMode( THREE.NormalBlending ) 
);

const scenePass = pass( scene, camera );
scenePass.setMRT( mrtNode );

const emissivePass = scenePass.getTextureNode( 'emissive' );

const bloomPass = bloom( emissivePass, 2.5, .5 );

const renderPipeline = new THREE.RenderPipeline( renderer );
renderPipeline.outputNode = outputPass.add( bloomPass );
	</code>
	</step>

	<step id="mrt-to-inspector">
	<code file="mrt.js" lang="javascript" typewriter="true" speed="fast" focus=".toInspector( 'emissive' ), .toInspector( 'bloom' )">
import * as THREE from 'three/webgpu';
import { mrt, output, emissive, vec4 } from 'three/tsl';

const mrtNode = mrt( {
	output: output,
	emissive: vec4( emissive, output.a )
} );

mrtNode.setBlendMode( 
	'emissive',
	new THREE.BlendMode( THREE.NormalBlending ) 
);

const scenePass = pass( scene, camera );
scenePass.setMRT( mrtNode );

const emissivePass = scenePass.getTextureNode( 'emissive' ).toInspector( 'emissive' );

const bloomPass = bloom( emissivePass, 2.5, .5 ).toInspector( 'bloom' );

const renderPipeline = new THREE.RenderPipeline( renderer );
renderPipeline.outputNode = outputPass.add( bloomPass );
	</code>
	</step>
</step>

<step id="tsl-roadmap-guide" layout="center">
<title>TSL Guide</title>
<subtitle>Interactive documentation and live playground</subtitle>
</step>

<step id="tsl-guide" layout="video-expanded">
<title>TSL Guide</title>
<subtitle>Interactive documentation and live playground</subtitle>

<video id="v-guide" src="assets/videos/tsl_guide.mp4" name="TSL Guide" highlight="true"></video>
</step>

<step id="tsl-guide-architecture" layout="nodes">
<title>TSL Guide</title>
<subtitle>Interactive documentation and live playground</subtitle>

<node id="node-tour-md" name="Tour.md" description="Markdown Documentation Source" icon="fa-file-lines" x="50" y="20" color="#38bdf8" highlight="true"></node>
<node id="node-llms-txt" name="llms-full.txt" description="Pre-compiled Knowledge Base" icon="fa-robot" x="24" y="70" color="#a855f7"></node>
<node id="node-tsl-website" name="TSL Guide Website" description="Live Interactive Playground" icon="fa-globe" x="76" y="70" color="#06b6d4"></node>

<edge from="node-tour-md" to="node-llms-txt" from-port="bottom" to-port="top" label="Pre-compiled"></edge>
<edge from="node-tour-md" to="node-tsl-website" from-port="bottom" to-port="top" label="On the Fly"></edge>
</step>


<step id="workshop" layout="video-expanded">
<title>Workshop</title>

<qrcode src="images/cyberpunk" url="https://github.com/ektogamat/threejs-conference"></qrcode>

<video src="assets/videos/cyberpunk.mp4" name="Cyberpunk Scene" highlight="true"></video>
</step>

<step id="workshop-community" layout="video-expanded">
<title>Workshop</title>

<video src="assets/videos/workshop.mp4" name="Community Feedback" window="false" vertical="true" width="820px" highlight="true"></video>
</step>

<step id="workshop-photo" layout="video-expanded">
<title>Workshop</title>

<image src="workshop.jpg" name="Workshop Class"></image>
</step>

<step id="thank-you" layout="center">
<image src="assets/icon.svg" color="white"></image>
<title>Thank You ♡ Merci</title>
<subtitle><i class="fa-brands fa-x-twitter text-cyan-400 mr-2"></i>Follow [@threejs](https://x.com/threejs) on [x.com/threejs](https://x.com/threejs)</subtitle>
</step>



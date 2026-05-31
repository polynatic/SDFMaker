import {Shader} from "./shader.js";
import {ShaderJFA} from "./shaderJFA.js";
import {gl} from "./gl.js";

export class ShaderSDF extends Shader {
    // language=GLSL
    static #SHADER_FRAGMENT = ShaderJFA.SHADER_PACK + `
        uniform highp usampler2D atlas;
        uniform sampler2D source;
        uniform sampler2D sourceColor;
        uniform uvec2 size;
        uniform float radius;
        uniform float threshold;
        uniform bool tileX;
        uniform bool tileY;
         
        in vec2 vUv;

        out vec4 color;

        void main() {            
            uvec2 nearestIn, nearestOut;
            ivec2 atlasCoordinate = ivec2(vUv * vec2(size) + .5);
            uvec2 atlasPixels = texelFetch(atlas, atlasCoordinate, 0).rg;

            jfaUnpack(atlasPixels.x, nearestIn);
            jfaUnpack(atlasPixels.y, nearestOut);
            
            
            // vec3 sourceColor = texture(sourceColor, vUv).rgb;
            vec3 sourceColor = vec3(1, 1, 1); // all channels white
            
            ivec2 deltaIn = atlasCoordinate - ivec2(nearestIn);
            ivec2 deltaOut = atlasCoordinate - ivec2(nearestOut);
            
            if (tileX) {
                int w = int(size.x);
                deltaIn.x  = ((deltaIn.x  % w) + w + w/2) % w - w/2;
                deltaOut.x = ((deltaOut.x % w) + w + w/2) % w - w/2;
            }
            if (tileY) {
                int h = int(size.y);
                deltaIn.y  = ((deltaIn.y  % h) + h + h/2) % h - h/2;
                deltaOut.y = ((deltaOut.y % h) + h + h/2) % h - h/2;
            }
            
            if (texelFetch(source, atlasCoordinate, 0).a > threshold)
                color = vec4(sourceColor, min(1., .5 + length(vec2(deltaIn)) / radius));
            else
                color = vec4(sourceColor, max(0., .5 - length(vec2(deltaOut)) / radius));
        }
    `;

    #uniformSize;
    #uniformRadius;
    #uniformThreshold;
    #uniformTileX;
    #uniformTileY;

    constructor() {
        super(ShaderSDF.#SHADER_FRAGMENT);

        this.use();

        gl.uniform1i(this.uniformLocation("sourceColor"), 0);
        gl.uniform1i(this.uniformLocation("source"), 1);
        gl.uniform1i(this.uniformLocation("atlas"), 2);

        this.#uniformSize = this.uniformLocation("size");
        this.#uniformRadius = this.uniformLocation("radius");
        this.#uniformThreshold = this.uniformLocation("threshold");
        this.#uniformTileX = this.uniformLocation("tileX");
        this.#uniformTileY = this.uniformLocation("tileY");
    }

    setSize(width, height) {
        gl.uniform2ui(this.#uniformSize, width, height);
    }

    setRadius(radius) {
        gl.uniform1f(this.#uniformRadius, radius);
    }

    setThreshold(threshold) {
        gl.uniform1f(this.#uniformThreshold, threshold);
    }

    setTile(x, y) {
        gl.uniform1f(this.#uniformTileX, x);
        gl.uniform1f(this.#uniformTileY, y);
    }
}
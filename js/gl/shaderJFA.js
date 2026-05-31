import {Shader} from "./shader.js";
import {gl} from "./gl.js";

export class ShaderJFA extends Shader {
    // language=GLSL
    static SHADER_PACK = `
        const uint jfaMarkedBit = 1u << 30u;

        uint jfaPack(const uint x, const uint y, const bool marked) {
            uint coordinates = x | (y << 15u);

            if (marked)
                return coordinates | jfaMarkedBit;

            return coordinates;
        }

        void jfaUnpack(const uint packed, out uvec2 unpacked) {
            const uint mask = (1u << 15u) - 1u;

            unpacked = uvec2(packed, packed >> 15u) & mask;
        }

        void jfaUnpack(const uint packed, out uvec2 unpacked, out bool marked) {
            jfaUnpack(packed, unpacked);

            marked = (packed & jfaMarkedBit) == jfaMarkedBit;
        }
    `;

    // language=GLSL
    static #SHADER_FRAGMENT = ShaderJFA.SHADER_PACK + `
        uniform highp usampler2D source;
        uniform uint step;
        uniform uvec2 size;
        uniform bool tileX;
        uniform bool tileY;

        in vec2 vUv;

        out highp uvec2 coordinates;

        void main() {
            uvec2 distances;
            uvec2 pixels;
            uvec4 pixelCoordinates;
            bool markedOut, markedIn;
            ivec4 deltas;
            ivec2 center = ivec2(gl_FragCoord.xy);
            uvec2 bestDistances = uvec2(0xFFFFFFFFu);
            uvec2 bestCoordinates = uvec2(0xFFFFFFFFu);

            for (int y = -1; y < 2; ++y) for (int x = -1; x < 2; ++x) {
                ivec2 sampleCoordinate = center + ivec2(x, y) * int(step);
                
                if(tileX){
                    sampleCoordinate.x = (sampleCoordinate.x + int(size.x)) % int(size.x);
                }
                if(tileY){
                    sampleCoordinate.y = (sampleCoordinate.y + int(size.y)) % int(size.y);
                }
                
                pixels = texelFetch(source, clamp(sampleCoordinate, ivec2(0), ivec2(size) - 1), 0).rg;

                jfaUnpack(pixels.x, pixelCoordinates.xy, markedOut);
                jfaUnpack(pixels.y, pixelCoordinates.zw, markedIn);

                deltas = ivec4(
                    ivec2(pixelCoordinates.x, pixelCoordinates.y),
                    ivec2(pixelCoordinates.z, pixelCoordinates.w)) - ivec4(center, center);
                    
               if (tileX) {
                    int w = int(size.x);
                    deltas.x = (deltas.x + w / 2 + w) % w - w / 2;
                    deltas.z = (deltas.z + w / 2 + w) % w - w / 2;
                }
                if (tileY) {
                    int h = int(size.y);
                    deltas.y = (deltas.y + h / 2 + h) % h - h / 2;
                    deltas.w = (deltas.w + h / 2 + h) % h - h / 2;
                }
                    
                distances = uvec2(
                    deltas.x * deltas.x + deltas.y * deltas.y,
                    deltas.z * deltas.z + deltas.w * deltas.w);

                if (markedOut && distances.x < bestDistances.x) {
                    bestDistances.x = distances.x;
                    bestCoordinates.x = pixels.x;
                }
                
                if (markedIn && distances.y < bestDistances.y) {
                    bestDistances.y = distances.y;
                    bestCoordinates.y = pixels.y;
                }
            }

            coordinates = bestCoordinates;
        }
    `;

    #uniformStep;
    #uniformSize;
    #uniformTileX;
    #uniformTileY;

    constructor() {
        super(ShaderJFA.#SHADER_FRAGMENT);

        this.use();

        this.#uniformStep = this.uniformLocation("step");
        this.#uniformSize = this.uniformLocation("size");
        this.#uniformTileX = this.uniformLocation("tileX");
        this.#uniformTileY = this.uniformLocation("tileY");
    }

    setStep(step) {
        gl.uniform1ui(this.#uniformStep, step);
    }

    setSize(width, height) {
        gl.uniform2ui(this.#uniformSize, width, height);
    }

    setTile(x, y) {
        gl.uniform1f(this.#uniformTileX, x);
        gl.uniform1f(this.#uniformTileY, y);
    }
}
import { convertXYZToLatLonHeight } from './cesium'
import axios from 'axios';

// 混沌Logistic映射生成器
function logisticMap(z, mu = 4) {
    return mu * z * (1 - z);
}

// 粒子类
class VPParticle {
    constructor(position) {
        // 使用输入数组初始化粒子的位置和方向，roll 默认为 0
        this.start = { ...position };
        this.position = { ...position };
        this.velocity = {
            x: Math.random() - 0.5,
            y: Math.random() - 0.5,
            z: Math.random() - 0.5
        };
        this.bestPosition = { ...this.position };
        this.bestFitness = -Infinity; // 初始化适应度
        this.fitness = -Infinity;
        this.chaosFactor = Math.random(); // 混沌因子
    }

    // 更新适应度函数
    async updateFitness(fitness) {
        this.fitness = fitness;
        if (this.fitness > this.bestFitness) {
            this.bestFitness = this.fitness;
            this.bestPosition = { ...this.position };
            // let p = convertXYZToLatLonHeight(this.position.x, this.position.y, this.position.z,)
            // axios.post('https://signow.space/mapi/vupoint/addPart', {
            //     x: p.longitude,
            //     y: p.latitude,
            //     z: p.height,
            //     fit: this.fitness
            // }, {
            //     headers: {
            //         'Content-Type': 'application/x-www-form-urlencoded'
            //     }
            // })
        }
    }
    // 重新初始化粒子位置，基于输入的particleDataArray中的随机粒子
    reinitializePosition() {
        this.position = { ...this.start }
        // 重置速度
        this.velocity = {
            x: Math.random() - 0.5,
            y: Math.random() - 0.5,
            z: Math.random() - 0.5,
            heading: Math.random() - 0.5,
            pitch: Math.random() - 0.5
        };
    }

    // 更新速度和位置
    updateVelocityAndPosition(globalBestPosition, inertia, c1, c2) {
        // 检查适应度值
        if (this.fitness < 0) {
            this.reinitializePosition();
        }
        const r1 = logisticMap(this.chaosFactor);
        const r2 = logisticMap(r1);

        // 更新速度
        this.velocity.x = inertia * this.velocity.x +
            c1 * r1 * (this.bestPosition.x - this.position.x) +
            c2 * r2 * (globalBestPosition.x - this.position.x);
        this.velocity.y = inertia * this.velocity.y +
            c1 * r1 * (this.bestPosition.y - this.position.y) +
            c2 * r2 * (globalBestPosition.y - this.position.y);
        this.velocity.z = inertia * this.velocity.z +
            c1 * r1 * (this.bestPosition.z - this.position.z) +
            c2 * r2 * (globalBestPosition.z - this.position.z);

        // 更新位置
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
        this.position.z += this.velocity.z;

        // 更新混沌因子
        this.chaosFactor = logisticMap(this.chaosFactor);
    }
}

// CPSO 类
export class CVPPSO {
    constructor(particleDataArray, center, fitnessFunc, maxIterations = 100, params = { inertia: 0.7, c1: 1.0, c2: 1.5 }) {
        // 根据输入数组初始化粒子
        this.particles = particleDataArray.map(data => new VPParticle(data.position));
        this.globalBestPosition = { x: 0, y: 0, z: 0 };
        this.globalBestFitness = -Infinity;
        this.fitnessFunc = fitnessFunc;
        this.maxIterations = maxIterations;
        this.inertia = params.inertia;
        this.c1 = params.c1;
        this.c2 = params.c2;
        this.center = center;
    }

    // 优化方法，返回全局最优的位置、姿态和适应度值
    async optimize() {
        for (let iteration = 0; iteration < this.maxIterations; iteration++) {
            for (let particle of this.particles) {
                // 更新适应度值
                let fitness = await this.fitnessFunc(this.center, particle.position)
                await particle.updateFitness(fitness);

                // 更新全局最佳
                if (particle.fitness > this.globalBestFitness) {
                    this.globalBestFitness = particle.fitness;
                    this.globalBestPosition = { ...particle.bestPosition };
                }
            }

            // 更新每个粒子的速度和位置
            for (let particle of this.particles) {
                particle.updateVelocityAndPosition(
                    this.globalBestPosition,
                    this.inertia,
                    this.c1,
                    this.c2
                );
            }

            // 输出当前最佳适应度
            console.log(`Iteration ${iteration + 1}: Global Best Fitness = ${this.globalBestFitness}`);

            // 在 Cesium 中可视化每代最优粒子
            // visualizeBestParticle({
            //     position: this.globalBestPosition
            // }, iteration + 1, this.center);

            // axios.post('https://signow.space/mapi/vupoint/addPso', {
            //     n_all: this.particles.length,
            //     g_all: this.maxIterations,
            //     fit: this.globalBestFitness,
            //     g_self: iteration + 1
            // }, {
            //     headers: {
            //         'Content-Type': 'application/x-www-form-urlencoded'
            //     }
            // })
        }

        // 返回全局最优的粒子位置、姿态和适应度值
        return {
            position: this.globalBestPosition,
            fitness: this.globalBestFitness
        };
    }
}

// 示例适应度函数
// function fitnessFunction(position) {
//     // 计算适应度（根据场景需要修改）
//     return position.x * position.y * position.z; // 这里只是一个简单的示例
// }

// 输入数组示例，每个元素代表一个粒子的初始位置和方向
// const particleDataArray = [
//     { position: { x: 100, y: 200, z: 300 } },
//     { position: { x: 150, y: 250, z: 350 }},
//     // 可以根据需求继续添加更多粒子的初始位置和方向
// ];

// 初始化并运行 CPSO
// const cVPPso = new CVPPSO(particleDataArray, fitnessFunction, 100);
// const result = chaoticVPPso.optimize();

// 输出全局最优的结果
// console.log('Optimal Position:', result.position);
// console.log('Optimal Fitness:', result.fitness);

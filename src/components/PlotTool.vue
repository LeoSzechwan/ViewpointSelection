<!--
 * @file: PlotTool.vue
 * @description: 标绘工具
 * @author: Szechwan
 * @version: 1.0.0
 * @date: 2024-04-26
-->
<template>
  <div id="tool-panel">
    <div v-for="op in operations" :key="op.id" :content="op.title">
      <el-button @click="op.handlerClick" link>
        <i :class="op.icon"></i>
      </el-button>
    </div>
  </div>

  <el-dialog v-model="optimizeDialog" width="30%" title="优化选项">
    <el-form :model="optParams">
      <el-form-item label="主体要素">
        <el-select v-model="optParams.scene" @change="loadData">
          <el-option v-for="op in opts" :label="op.name" :value="op.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="惯性权重">
        <el-input v-model="optParams.inertia" />
      </el-form-item>
      <el-form-item label="自我权重">
        <el-input v-model="optParams.c1" />
      </el-form-item>
      <el-form-item label="社会权重">
        <el-input v-model="optParams.c2" />
      </el-form-item>
      <el-form-item label="粒子数目">
        <el-input v-model="optParams.n" />
      </el-form-item>
      <el-form-item label="迭代次数">
        <el-input v-model="optParams.g" />
      </el-form-item>
      <el-form-item label="地形可视过滤">
        <el-switch v-model="optParams.terrainFilter" />
        <span>（严重影响性能）</span>
      </el-form-item>
    </el-form>
    <el-button type="primary" @click="flatViewBox()">
      最大可视面积
    </el-button>
    <el-button type="primary" @click="fixedView()">
      固定值
    </el-button>
    <el-button type="primary" @click="startOptimize">
      粒子优化
    </el-button>
    <el-button @click="optimizeDialog = false">取消</el-button>
  </el-dialog>
</template>

<script setup>
// cesium全局状态
import { ref } from "vue";
import { plotDraw, plotDrawToGeojson, loadScene, PSO, fixedView, flatViewBox, calculateEntityImportance } from "@/composables/cesium.js";
import { ElMessage } from "element-plus";
import bus from "@/js/common/bus.js";

let optimizeDialog = ref(false)

let opts = ref([
  {
    id: 'F1',
    name: '受灾区域1#',
  },
  {
    id: 'F2',
    name: '受灾区域2#',
  },
  {
    id: 'R1',
    name: '中断路段1#',
  },
  {
    id: 'R2',
    name: '中断路段2#',
  },
  {
    id: 'R3',
    name: '中断路段3#',
  },
  {
    id: 'R4',
    name: '中断路段4#',
  },
  {
    id: 'R5',
    name: '中断路段5#',
  },
  {
    id: 'R6',
    name: '中断路段6#',
  },
  {
    id: 'R7',
    name: '中断路段7#',
  },
  {
    id: 'SS',
    name: '信号基站',
  },
  {
    id: 'B1',
    name: '受损桥梁1#',
  },
  {
    id: 'B2',
    name: '受损桥梁2#',
  },
  {
    id: 'B3',
    name: '受损桥梁3#',
  }
])

let optParams = ref({
  main: 'F1',
  n: 100,
  g: 200,
  inertia: 0.7,
  c1: 1.0,
  c2: 1.5,
  terrainFilter: false
})

// 标绘选项
const operations = ref([
  {
    id: 1,
    title: "点",
    icon: "iconfont icon-double-circle",
    handlerClick: function () {
      toPlot("point", "点");
    },
  },
  {
    id: 2,
    title: "线",
    icon: "iconfont icon-changdu",
    handlerClick: function () {
      toPlot("polyline", "线");
    },
  },
  {
    id: 3,
    title: "面",
    icon: "iconfont icon-mianji",
    handlerClick: function () {
      toPlot("polygon", "面");
    },
  },
  {
    id: 4,
    title: "文字标记",
    icon: "iconfont icon-wenzi",
    handlerClick: function () {
      toPlot("label", "文字标记");
    },
  },
  {
    id: 5,
    title: "清除",
    icon: "iconfont icon-qingchu",
    handlerClick: function () {
      plotDrawToGeojson();
      // plotDraw();
    },
  },
  {
    id: 6,
    title: "视点优化",
    icon: "iconfont icon-jiaodu",
    handlerClick: function () {
      optimizeDialog.value = true
    },
  },
]);

let eventId = ref("");
bus.on("selectedEvent", (flag) => {
  eventId.value = flag;
});

const toPlot = (type, title) => {
  bus.emit("PlotInfo", {
    type: type,
    title: title,
    status: "新建"
  });
};

const loadData = () => {
  console.log('importance', calculateEntityImportance(optParams.value.main))
}

const startOptimize = () => {
  PSO(optParams.value.n, optParams.value.g, 'A', {
    inertia: optParams.value.inertia,
    c1: optParams.value.c1,
    c2: optParams.value.c2
  }, optParams.value.terrainFilter)
}
</script>

<style lang="scss" scoped>
@import "@/assets/plotTool/iconfont.css";

#tool-panel {
  position: absolute;
  padding: 5px;
  right: 5px;
  border-radius: 10px;
  z-index: 2;
  row-gap: 15px;
  column-gap: 5px;
}

.color-alpha-slider,
.alpha-slider {
  display: flex;
  width: 300px;
}

.options {
  display: flex;
  margin-left: 15px;
  flex-wrap: wrap;
  width: 70%;
}
</style>

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
</template>

<script setup>
// cesium全局状态
import { ref } from "vue";
import { plotDraw, plotDrawToGeojson } from "@/composables/cesium.js";
import { ElMessage } from "element-plus";
import bus from "@/js/common/bus.js";

// 标绘选项
const operations = ref([
  {
    id: 0,
    title: "图标",
    icon: "iconfont icon-double-circle",
    handlerClick: function () {
      toPlot("billboard", "图标");
    },
  },
  {
    id: 1,
    title: "线路",
    icon: "iconfont icon-changdu",
    handlerClick: function () {
      toPlot("polyline", "线路");
    },
  },
  {
    id: 2,
    title: "区域",
    icon: "iconfont icon-mianji",
    handlerClick: function () {
      toPlot("polygon", "区域");
    },
  },
  {
    id: 3,
    title: "文字标记",
    icon: "iconfont icon-wenzi",
    handlerClick: function () {
      toPlot("label", "文字标记");
    },
  },
  {
    id: 4,
    title: "清除",
    icon: "iconfont icon-qingchu",
    handlerClick: function () {
      plotDrawToGeojson();
      plotDraw();
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

<template>
  <div id="cesium-container">
    <PlotTool></PlotTool>
    <PlotInfo></PlotInfo>
    <div id="info-label">
      <div>
        <span>{{ longitude }}°,</span>
        <span>{{ latitude }}°,</span>
        <span>{{ altitude }}m,</span>
      </div>
      <div style="display: flex; flex-wrap: nowrap">
        <span>α: {{ heading }}°</span>
        <span>β: {{ pitch }}°</span>
        <span>γ: {{ roll }}°</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useCesiumViewer } from "@/composables/cesium.js";
import { useCesiumStore } from "@/store/cesium.js";
import PlotTool from './PlotTool.vue';
import PlotInfo from './PlotInfo.vue'

// 观察相机位姿
let latitude = ref(0);
let longitude = ref(0);
let altitude = ref(0);
let heading = ref(0);
let pitch = ref(0);
let roll = ref(0);
onMounted(() => {
  useCesiumViewer("cesium-container");
  const store = useCesiumStore();
  const viewer = store.viewer;
  viewer.camera.moveEnd.addEventListener(() => {
    latitude.value = Cesium.Math.toDegrees(
      viewer.scene.camera.positionCartographic.latitude
    ).toFixed(6);
    longitude.value = Cesium.Math.toDegrees(
      viewer.scene.camera.positionCartographic.longitude
    ).toFixed(6);
    altitude.value = viewer.scene.camera.positionCartographic.height.toFixed(1);
    heading.value = viewer.scene.camera.heading.toFixed(3);
    pitch.value = viewer.scene.camera.pitch.toFixed(3);
    roll.value = viewer.scene.camera.roll.toFixed(3);
  });
});
</script>

<style scoped>
#cesium-container {
  height: 100%;
  width: 100%;
}

#info-label {
  position: absolute;
  width: 100%;
  right: 5px;
  bottom: 5px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: end;
  z-index: 4;
  font-size: 0.8rem;
  color: #fff;
  text-shadow: -0.05rem -0.05rem 0 #111, 0.05rem -0.05rem 0 #111,
    -0.05rem 0.05rem 0 #111, 0.05rem 0.05rem 0 #111;
}
</style>

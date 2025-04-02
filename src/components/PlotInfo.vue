<template>
  <div id="plotinfo-container" v-show="isStartDraw">
    <el-form :model="elementInfo" ref="plotForm">
      <span>{{ `${elementInfo.status}${elementInfo.title}要素` }}</span>
      <el-form-item label="名称" prop="plot.name" :rules="{
        required: true,
        message: '请输入文字',
        trigger: ['blur', 'change'],
      }">
        <el-input v-model="elementInfo.plot.name"></el-input>
      </el-form-item>

      <el-form-item label="填充颜色" v-if="elementInfo.plot.type != 'label'">
        <el-color-picker v-model="elementInfo.plot.style.color" style="display: flex" />
        <div class="alpha-slider">
          <span style="width: 80px">透明度</span>
          <el-slider v-model="elementInfo.plot.style.colorAlpha" :max="1" :min="0" :step="0.1"></el-slider>
        </div>
      </el-form-item>

      <el-form-item label="大小" v-if="elementInfo.plot.type == 'point'">
        <el-input-number :min="1" v-model="elementInfo.plot.style.pixelSize" />
      </el-form-item>

      <el-form-item label="轮廓" v-if="elementInfo.plot.type == 'point' || elementInfo.plot.type == 'polygon'">
        <div class="options">
          <el-switch v-model="elementInfo.plot.style.outline"></el-switch>
          <div v-if="elementInfo.plot.style.outline" class="options">
            <div class="color-alpha-slider">
              <span style="width: 40px">颜色</span><el-color-picker v-model="elementInfo.plot.style.outlineColor" />
              <div class="alpha-slider">
                <span style="width: 80px">透明度</span>
                <el-slider v-model="elementInfo.plot.style.outlineColorAlpha" :max="1" :min="0" :step="0.1"></el-slider>
              </div>
            </div>
            <div style="margin-left: 5px">
              <span style="width: 40px; margin-right: 5px">宽度</span><el-input-number :min="1"
                v-model="elementInfo.plot.style.outlineWidth" />
            </div>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="贴合地形" v-if="elementInfo.plot.type == 'polyline' || elementInfo.plot.type == 'polygon'">
        <el-switch v-model="elementInfo.plot.style.clampToGround"></el-switch>
      </el-form-item>
      <el-form-item label="线条宽度" v-if="elementInfo.plot.type == 'polyline'"><el-input-number :min="1"
          v-model="elementInfo.plot.style.width" />
      </el-form-item>

      <el-form-item label="文字内容" prop="plot.style.text" v-if="elementInfo.plot.type == 'label'" :rules="{
        required: true,
        message: '请输入文字',
        trigger: ['blur', 'change'],
      }">
        <el-input v-model="elementInfo.plot.style.text" :input-style="{
          fontSize: elementInfo.plot.style.fontSize + 'px',
          color: elementInfo.plot.style.fillColor,
          backgroundColor: (elementInfo.plot.style.showBackground ? elementInfo.plot.style.backgroundColor : '')
        }"></el-input>
      </el-form-item>
      <el-form-item label="文字大小" v-if="elementInfo.plot.type == 'label'">
        <div class="alpha-slider">
          <span style="font-size: 8px">小</span>
          <el-slider v-model="elementInfo.plot.style.fontSize" :max="32" :min="8" :step="2"
            style="margin-left: 10px; margin-right: 10px"></el-slider>
          <span style="font-size: 32px">大</span>
        </div>
      </el-form-item>
      <el-form-item label="文字颜色" v-if="elementInfo.plot.type == 'label'">
        <el-color-picker v-model="elementInfo.plot.style.fillColor" />
        <div class="alpha-slider">
          <span style="width: 80px">透明度</span>
          <el-slider v-model="elementInfo.plot.style.fillColorAlpha" :max="1" :min="0" :step="0.1"></el-slider>
        </div>
      </el-form-item>
      <el-form-item label="背景板" v-if="elementInfo.plot.type == 'label'">
        <el-switch v-model="elementInfo.plot.style.showBackground" style="align-self: start"></el-switch>
        <div v-if="elementInfo.plot.style.showBackground">
          <span>颜色</span><el-color-picker v-model="elementInfo.plot.style.backgroundColor" />
          <div class="alpha-slider">
            <span style="width: 80px">透明度</span>
            <el-slider v-model="elementInfo.plot.style.backgroundColorAlpha" :max="1" :min="0" :step="0.1"></el-slider>
          </div>
        </div>
      </el-form-item>
    </el-form>
    <div>
      <el-button type="primary" @click="submit()"> 确认 </el-button>
      <el-button @click="isStartDraw = false">关闭</el-button>
    </div>
  </div>
</template>

<script setup>
// 引入封装的方法
import { ref } from "vue";
import { plotDraw } from "@/composables/cesium.js";
import bus from "@/js/common/bus.js";
import "//at.alicdn.com/t/c/font_4676843_zzpcsy78w0c.js";

// 标记要素
let isStartDraw = ref(false);

let elementInfo = ref({
  status: "新建",
  plot: {
    type: "",
    name: "",
    style: {
      text: "",
      fillColor: "#fff",
      fillColorAlpha: 1.0,
      outline: false,
      outlineWidth: 1,
      outlineColor: "#00FFFF",
      outlineColorAlpha: 1.0,
      heightReference: 0,
      showBackground: true,
      backgroundColor: "#000",
      backgroundColorAlpha: 1.0,
      scale: 1,
      color: "#ff0000",
      colorAlpha: 1.0,
      clampToGround: true,
      width: 3,
      pixelSize: 10,
      fontSize: 16,
    },
  },
});

// 标绘表单
let plotForm = ref();
bus.on("PlotInfo", (flag) => {
  elementInfo.value.status = flag.status;
  elementInfo.value.title = flag.title;
  elementInfo.value.plot.type = flag.type;
  if (flag.status == "新建") {
    elementInfo.value.name = "";
    elementInfo.value.type = {};
    elementInfo.value.plot.style.scale = 1;
  }
  isStartDraw.value = true;
});

const submit = () => {
  plotForm.value.validate((validPlot) => {
    if (validPlot) {
      // isStartDraw.value = false;
      elementInfo.value.plot.style.image = getSvgUrl(
        elementInfo.value.type.icon
      );
      plotDraw(elementInfo.value.plot);
    }
  });
};

const getSvgUrl = (iconId) => {
  // 构造一个完整的SVG字符串
  iconId = iconId || "icon-weizhizhuangtai";
  let url = `https://signow.space/media/img/mapatory/${iconId}.svg`;
  return url;
};
</script>

<style>
#plotinfo-container {
  position: absolute;
  top: 150px;
  right: 5px;
  z-index: 2;
  width: 200px;
  background-color: #b3b3b3ee;
  padding: 15px;
  border-radius: 5px;
}

.color-alpha-slider,
.alpha-slider {
  display: flex;
  width: 100px;
}

.options {
  display: flex;
  flex-wrap: wrap;
  width: 100px;
}

.icon {
  width: 1em;
  height: 1em;
}
</style>

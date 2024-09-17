<template>
  <div id="plotinfo-container" v-show="isStartDraw">
    <el-form :model="elementInfo" ref="plotForm">
      <span>{{ `${elementInfo.status}${elementInfo.title}要素` }}</span>
      <el-form-item
        label="名称"
        prop="name"
        :rules="{
          required: true,
          message: '请输入文字',
          trigger: ['blur', 'change'],
        }"
      >
        <el-input v-model="elementInfo.name"></el-input>
      </el-form-item>
      <el-form-item
        label="类型"
        prop="type"
        v-if="elementInfo.plot.type != 'label'"
      >
        <el-select
          v-model="elementInfo.type"
          placeholder="请选择类型"
          value-key="id"
        >
          <template #label>
            <div>
              <img class="icon" :src="getSvgUrl(elementInfo.type.icon)" />
              <span>{{ elementInfo.type.name }}</span>
            </div>
          </template>
          <el-option
            v-for="tp in elementTypes"
            :key="tp.id"
            :label="tp.name"
            :value="tp"
          >
            <template #default>
              <div>
                <img class="icon" :src="getSvgUrl(tp.icon)" />
                <span>{{ tp.name }}</span>
              </div>
            </template>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="图标" v-if="elementInfo.plot.type == 'billboard'">
        <svg
          aria-hidden="true"
          :transform="`scale(${elementInfo.plot.style.scale})`"
          v-if="elementInfo.type.icon"
        >
          <use :xlink:href="'#' + elementInfo.type.icon"></use>
        </svg>
        <div class="alpha-slider" v-if="elementInfo.type.icon">
          <span style="width: 60px">大小</span>
          <el-slider
            v-model="elementInfo.plot.style.scale"
            :max="1"
            :min="0.1"
            :step="0.1"
          ></el-slider>
        </div>
        <div v-else>无</div>
      </el-form-item>
      <el-form-item
        label="文字内容"
        prop="plot.style.text"
        v-if="elementInfo.plot.type == 'label'"
        :rules="{
          required: true,
          message: '请输入文字',
          trigger: ['blur', 'change'],
        }"
      >
        <el-input
          v-model="elementInfo.plot.style.text"
          :input-style="{ 
            fontSize: elementInfo.plot.style.fontSize + 'px',
            color:elementInfo.plot.style.fillColor,
            backgroundColor:(elementInfo.plot.style.showBackground?elementInfo.plot.style.backgroundColor:'')
            }"
        ></el-input>
      </el-form-item>
      <el-form-item label="文字大小" v-if="elementInfo.plot.type == 'label'">
        <div class="alpha-slider">
          <span style="font-size: 8px">小</span>
          <el-slider
            v-model="elementInfo.plot.style.fontSize"
            :max="32"
            :min="8"
            :step="2"
            style="margin-left: 10px; margin-right: 10px"
          ></el-slider>
          <span style="font-size: 32px">大</span>
        </div>
      </el-form-item>
      <el-form-item label="文字颜色" v-if="elementInfo.plot.type == 'label'">
        <el-color-picker v-model="elementInfo.plot.style.fillColor" />
        <div class="alpha-slider">
          <span style="width: 80px">透明度</span>
          <el-slider
            v-model="elementInfo.plot.style.fillColorAlpha"
            :max="1"
            :min="0"
            :step="0.1"
          ></el-slider>
        </div>
      </el-form-item>
      <el-form-item label="背景板" v-if="elementInfo.plot.type == 'label'">
        <el-switch
          v-model="elementInfo.plot.style.showBackground"
          style="align-self: start"
        ></el-switch>
        <div v-if="elementInfo.plot.style.showBackground">
          <span>颜色</span
          ><el-color-picker v-model="elementInfo.plot.style.backgroundColor" />
          <div class="alpha-slider">
            <span style="width: 80px">透明度</span>
            <el-slider
              v-model="elementInfo.plot.style.backgroundColorAlpha"
              :max="1"
              :min="0"
              :step="0.1"
            ></el-slider>
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
  name: "",
  type: {
    id: "",
    name: "",
    icon: "",
  },
  title: "",
  status: "新建",
  plot: {
    type: "",
    style: {
      text: "",
      fillColor: "#fff",
      fillColorAlpha: 1.0,
      showBackground: true,
      backgroundColor: "#000",
      backgroundColorAlpha: 1.0,
      scale: 1,
      clampToGround: true,
      fontSize: 16,
      image: null,
      color: "#ff0000",
    },
  },
});

let elementTypes = ref([]);

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
  top: 100px;
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
  width: 300px;
}

.icon {
  width: 1em;
  height: 1em;
}
</style>

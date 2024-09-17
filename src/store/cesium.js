import { defineStore } from 'pinia';

export const useCesiumStore = defineStore('cesium', {
  //全局数据
  state: () => {
    return {
      viewer: null
    }
  },

  //计算属性
  getters: {

  },

  //数据处理方法
  actions: {
    //初始化Scene
    update(viewer) {
      this.viewer = viewer
    }
  }
})
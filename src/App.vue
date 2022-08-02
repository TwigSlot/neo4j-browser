<template>
  <img alt="Vue logo" src="./assets/logo.png">
  <HelloWorld msg="Welcome to Your Vue.js App"/> -->
  <v-network-graph :nodes="nodes" :edges="edges" />
</template>

<script>
// import HelloWorld from './components/HelloWorld.vue'

// export default {
//   name: 'App',
//   components: {
//     HelloWorld
//   }
// }

import { defineComponent } from "vue"
export default defineComponent({
  setup() {
    const nodes = {
      node1: { name: "Node 1" },
      node2: { name: "Node 2" },
      node3: { name: "Node 3" },
      node4: { name: "Node 4" },
    }
    const edges = {
      edge1: { source: "node1", target: "node2" },
      edge2: { source: "node2", target: "node3" },
      edge3: { source: "node3", target: "node4" },
    }
    return { nodes, edges }
  },
})
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>

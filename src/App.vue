<template>
  <text style='font-size:50px'>TwigSlot</text>
  <input type='checkbox' id='d3-force-enabled' v-model="d3ForceEnabled"/>
      <label for="d3-force-enabled">Auto-organise</label>
  <div id="graph">
    <v-network-graph 
    v-model:zoom-level="zoomLevel"
    :nodes="nodes"
    :edges="edges"
    :configs="configs"
    :event-handlers="eventHandlers"
    />
  </div>
  <text id="graph-div-error">ERROR: This message will disappear when the graph div is resized appropriately.</text>
</template>
<script setup>
console.log(eventLogs)
</script>

<script>
import { defineComponent, reactive, ref, computed } from "vue"
import * as vNG from "v-network-graph"
import {
  ForceLayout,
} from "v-network-graph/lib/force-layout"

const original_nodes = {
  node1: { name: "Node 1" },
  node2: { name: "Node 2" },
  node3: { name: "Node 3" },
  node4: { name: "Node 4" },
}
var original_edges = {
  edge1: { source: "node1", target: "node2" },
  edge2: { source: "node2", target: "node3" },
  edge3: { source: "node3", target: "node4" },
}
const nodes = reactive({ ...original_nodes })
const edges = reactive({ ...original_edges })
const nextNodeIndex = ref(Object.keys(nodes).length + 1)
const nextEdgeIndex = ref(Object.keys(edges).length + 1)

const selectedNodes = ref();
const selectedEdges = ref();
const eventLogs = reactive([])

function addNode() {
  const nodeId = `node${nextNodeIndex.value}`
  const name = `N${nextNodeIndex.value}`
  nodes[nodeId] = { name }
  nextNodeIndex.value++
}

function removeNode() {
  for (const nodeId of selectedNodes.value) {
    delete nodes[nodeId]
  }
}

function addEdge() {
  if (selectedNodes.value.length !== 2) return
  const [source, target] = selectedNodes.value
  const edgeId = `edge${nextEdgeIndex.value}`
  edges[edgeId] = { source, target }
  nextEdgeIndex.value++
}

function removeEdge() {
  for (const edgeId of selectedEdges.value) {
    delete edges[edgeId]
  }
}
export default defineComponent({
  data() {
    
    const configs = reactive(
      vNG.defineConfigs({
        view: {
          scalingObjects: true,
          minZoomLevel: 0.1,
          maxZoomLevel: 16,
          boxSelectionEnabled: true,
          selection: {
            box: {
              color: "#0000ff20",
              strokeWidth: 5,
              strokeColor: "#aaaaff",
              strokeDasharray: "0",
            },
          },
          layoutHandler: new ForceLayout({positionFixedByClickWithAltKey: true,})
        },
        node: {
          selectable: true,
        },
      })
    )
    const d3ForceEnabled = computed({
      get: () => configs.view.layoutHandler instanceof ForceLayout,
      set: (value) => {
        if (value) {
          configs.view.layoutHandler = new ForceLayout()
        } else {
          configs.view.layoutHandler = new vNG.SimpleLayout()
        }
      },
    })

    const EVENTS_COUNT = 6

    const eventHandlers = {
      // wildcard: capture all events
      "*": (type, event) => {
        if (eventLogs.length > EVENTS_COUNT) {
          eventLogs.splice(EVENTS_COUNT, eventLogs.length - EVENTS_COUNT)
        }
        if (event instanceof Object && "event" in event) {
          Object.assign(event, { event: "(...)" })
        }
        eventLogs.unshift([type, JSON.stringify(event)])
      },
    }
    const zoomLevel = ref(1.5)
    return { nodes, edges, configs, zoomLevel, d3ForceEnabled, eventHandlers }
  },
  mounted(){
    document.getElementById('graph-div-error').remove()
    var graph = document.getElementById('graph');
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const titleHeight = 100;
    graph.style.setProperty('height',`${windowHeight-titleHeight}px`)
    graph.style.setProperty('width',`${windowWidth*0.6}px`)
    window.vue = this
  }
})
</script>

<style>
#graph {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  background-color: aqua;
  /* margin-top: 60px; */
  height: 10px;
  overflow: hidden;
}
</style>

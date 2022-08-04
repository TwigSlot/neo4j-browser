<template>
  <div id="graph">
    <v-network-graph ref="graph" v-model:selected-nodes="selectedNodes" v-model:zoom-level="zoomLevel" :nodes="nodes"
      :edges="edges" :layouts="layouts" :configs="configs" :event-handlers="eventHandlers" />
  </div>

  <div class="control-panel">
    <text style='font-size:50px'>TwigSlot</text>
    <input type='checkbox' id='d3-force-enabled' v-model="d3ForceEnabled" />
    <label for="d3-force-enabled">Auto-organise</label>
    <input type='button' id='home' onclick='document.home()' value='home' />
    <textarea type="text" id="query-textarea" value="MATCH (p)-[e]->(q)
RETURN p,e,q
LIMIT 10" rows="4" cols="40"></textarea>
    <input type="button" id="query-button" value='query' onclick='document.query()' />
  </div>
  <div class="info-panel">
    <div v-if="dataPanel.labels">
      <h3>{{dataPanel.obj}} Properties</h3>
      <ul>
        <li v-for="(label,index) in dataPanel.labels" :key="index">{{label}}</li>
      </ul>
      <table v-bind:id="dataPanel.id">
        <tr>
          <th>&lt;id&gt;</th>
          <th>{{dataPanel.id}}</th>
        </tr>
        <!-- <p>{{dataPanel.properties}}</p> -->
        <tr v-for="(value, property) in dataPanel.properties" :key="value">
          <th>
            {{property}}
          </th>
          <th v-bind:id="'valueOf'+property" contenteditable="true" v-on:blur="onInput">
            {{value}}
          </th>
        </tr>
      </table>
    </div>
    <div v-else-if="dataPanel.obj">Creating {{dataPanel.obj}} in Neo4J... Hover over node again later to check</div>
    <div v-else>Hover over a node/edge to check it out</div>
  </div>
  <text id="graph-div-error">ERROR: This message will disappear when the graph div is resized appropriately.</text>
</template>
<script setup>

import neo4j, {session} from 'neo4j-driver'
const driver = neo4j.driver('bolt://3.87.191.133:7687',
  neo4j.auth.basic('neo4j', 'combination-opportunity-hammer'))

console.log('connecting to neo4j')
document.driver = driver;
driver.verifyConnectivity().then(()=>{
  console.log('connected');
  document.query();
});
document.home = function(){
  for(var j=0; j<1; ++j){ // TODO need to press home button twice
    const inf = 1000000000000;
    var minX = inf, minY = inf, maxX = -inf, maxY = -inf;
    for(const i in window.vue.layouts.nodes){
      minX = Math.min(minX,window.vue.layouts.nodes[i].x)
      minY = Math.min(minY,window.vue.layouts.nodes[i].y)
      maxX = Math.max(maxX,window.vue.layouts.nodes[i].x)
      maxY = Math.max(maxY,window.vue.layouts.nodes[i].y)
    }
    const padding = 100;
    window.vue.graph.setViewBox({
      left: minX-padding,
      top: minY-padding,
      right: maxX+padding*5,
      bottom: maxY+padding,
    })
  }
}
document.query = function(){
  const cypherQuery = document.getElementById('query-textarea').value;
  const session = driver.session({database: 'neo4j'});
  const tx = session.beginTransaction();
  
  tx.run(cypherQuery).then((res) => {
    for(let i in window.vue.nodes) delete window.vue.nodes[i]
    for(let i in window.vue.edges) delete window.vue.edges[i]
    const displayableProperties = ['title', 'name']
    res.records.forEach((record, index) => {
      var displayName = `Node ${index}`
      for(const key of record.keys){
        const field = record._fields[record._fieldLookup[key]]
        if(field.constructor.name == 'Node'){
          for(const displayableProperty of displayableProperties){
            if(displayableProperty in field.properties){
              displayName = field.properties[displayableProperty]
              break;
            }
          }
          var newVertex = addVertex(0,0,field.identity.toNumber())
          newVertex.nodeInfo = field;
          newVertex.name = displayName;
        }else if(field.constructor.name == 'Relationship'){
          console.log(field)
          const s = field.start.toNumber().toString()
          const t = field.end.toNumber().toString()
          var newEdge = document.addEdge(s,t);
          newEdge.edgeInfo = field;
        }else if(field.constructor.name == 'Integer'){
          continue;
        }
      }
    })
    session.close();
  }).catch((message) => {
    console.log(message);
  })
  
}
function initHandler(){
  document.viewClick = () => { };
  document.nodeSelect = () => { };
  document.nodeClick = () => { };
}
initHandler();
function setHandler(mode) {
  initHandler();
  if (mode == 'vertex') {
    document.viewClick = addVertexWithMouse;
  } else if (mode == 'edge') {
    document.nodeClick = addEdgePrep;
    document.nodeSelect = (e) => {
      if (e.length == 0) document.sourceNode = null
      else if (e.length == 2) document.addEdge(e[0], e[1])
    };
    return;
  }
}
document.onkeydown = function (e) {
  if (e.key == 'v') setHandler('vertex')
  else if (e.key == 'e') setHandler('edge')
}
document.addEdge = function (source, target) {
  const edgeId = `edge${nextEdgeIndex.value}`
  edges[edgeId] = { source, target }
  nextEdgeIndex.value++
  return edges[edgeId]
}
async function addEdgePrep(e) {
  if (document.sourceNode == null) {
    document.sourceNode = e.node;
  } else {
    const newEdge = document.addEdge(document.sourceNode, e.node)
    document.sourceNode = null;
    console.log(newEdge)

    const session = document.driver.session({
      database: 'neo4j',
    })
    const res = await session.writeTransaction(tx => {
      const query = `MATCH (a), (b) WHERE id(a)=${newEdge.source} AND id(b)=${newEdge.target} CREATE (a)-[e:Edge]->(b) RETURN e`
      return tx.run(query)
    })

    session.close()

    newEdge.edgeInfo = res.records[0].get('e')
    console.log(newEdge.edgeInfo)
  }
}
function addVertex(x,y,nodeId){
  // add node and its position
  if(nodeId == null){
    nodeId = `node${nextNodeIndex.value}`
    nextNodeIndex.value++
  }
  const name = `Node ${nextNodeIndex.value}`
  nodes[nodeId] = { name }
  window.vue.layouts.nodes[nodeId] = { x: x, y: y };
  return nodes[nodeId];
}
async function addVertexWithMouse(e) {
  const point = { x: e.offsetX, y: e.offsetY }
  // translate coordinates: DOM -> SVG
  const svgPoint = window.vue.graph.translateFromDomToSvgCoordinates(point)
  const newNode = addVertex(svgPoint.x, svgPoint.y);
  const session = document.driver.session({
    database: 'neo4j',
  })
  const res = await session.writeTransaction(tx => {
    const query = `CREATE (n) SET n.name='${newNode.name}' RETURN n`
    return tx.run(query)
  })

  session.close()

  newNode.nodeInfo = res.records[0].get('n')
  console.log(newNode.nodeInfo)
}

function removeNode() {
  for (const nodeId of selectedNodes.value) {
    delete nodes[nodeId]
  }
}

function removeEdge() {
  for (const edgeId of selectedEdges.value) {
    delete edges[edgeId]
  }
}
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
const graph = ref();
const nodes = reactive({ ...original_nodes })
const edges = reactive({ ...original_edges })
const nextNodeIndex = ref(Object.keys(nodes).length + 1)
const nextEdgeIndex = ref(Object.keys(edges).length + 1)

const selectedNodes = ref([]);
const selectedEdges = ref([]);
const eventLogs = reactive([])

const dataPanel = ref({})


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
          layoutHandler: new ForceLayout({ positionFixedByClickWithAltKey: true, })
        },
        node: {
          selectable: true,
        },
        edge: {
          selectable: true,
          normal: {
            width: 3,
            color: "#4466cc",
            dasharray: "0",
            linecap: "butt",
            animate: false,
            animationSpeed: 50,
          },
          marker: {
            source: {
              type: "none",
              width: 4,
              height: 4,
              margin: -1,
              units: "strokeWidth",
              color: null,
            },
            target: {
              type: "arrow",
              width: 4,
              height: 4,
              margin: -1,
              units: "strokeWidth",
              color: null,
            },
          },
        }
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
        // if (eventLogs.length > EVENTS_COUNT) {
        //   eventLogs.splice(EVENTS_COUNT, eventLogs.length - EVENTS_COUNT)
        // }
        // if (event instanceof Object && "event" in event) {
        //   Object.assign(event, { event: "(...)" })
        // }
        // eventLogs.unshift([type, JSON.stringify(event)])
        if (type == 'view:click') {
          document.viewClick(event.event);
        } else if (type == 'node:click') {
          document.nodeClick(event);
        } else if (type == 'node:select') {
          document.nodeSelect(event);
        } else if (type == 'node:pointerover'){ 
          const nodeInfo = nodes[event.node].nodeInfo
          // console.log(nodeInfo)
          dataPanel.value = {}
          dataPanel.value['obj'] = 'Node'
          if(nodeInfo){
            dataPanel.value['labels'] = nodeInfo.labels;
            dataPanel.value['id'] = nodeInfo.identity.toNumber();
            dataPanel.value['properties'] = nodeInfo.properties;
          }
        } else if(type == 'node:pointerout'){
          // console.log('i')
        } else if(type == 'edge:pointerover'){
          // console.log(type, event)
          const edgeInfo = edges[event.edge].edgeInfo
          dataPanel.value = {}
          dataPanel.value['obj'] = 'Relationship';
          if(edgeInfo){
            dataPanel.value['labels'] = [edgeInfo.type];
            dataPanel.value['id'] = edgeInfo.identity.toNumber();
            dataPanel.value['properties'] = edgeInfo.properties;
          }
        } else {
          console
          // console.log(type, event)
        }
      },
    }
    const zoomLevel = ref(1.5)
    const layouts = reactive({
      nodes: {
        node1: { x: 0, y: 0 },
        node2: { x: 50, y: 50 },
        node3: { x: 100, y: 0 },
        node4: { x: 150, y: 50 },
      },
    });
    return { graph, nodes, edges, configs, layouts, zoomLevel, d3ForceEnabled, eventHandlers, dataPanel }
  },
  methods:{
    async onInput(e){ // updated value
      const propertyName = (e.target.parentElement.children[0].innerText);
      const propertyValue = e.target.innerText;
      const objId = parseInt(e.target.parentElement.parentElement.id);
      console.log(propertyName, propertyValue, dataPanel.value['obj'], objId);
      const session = document.driver.session({
        database: 'neo4j',
      })


      // Create a node within a write transaction
      const res = await session.writeTransaction(tx => {
        var query;
        if (dataPanel.value['obj'] == 'Relationship') {
          query = `MATCH (a)-[n]->(b) WHERE id(n)=${objId} SET n.${propertyName}='${propertyValue}' RETURN n`
        }else if(dataPanel.value['obj'] == 'Node'){
          query = `MATCH (n) WHERE id(n)=${objId} SET n.${propertyName}='${propertyValue}' RETURN n`
        }else{
          console.log('neither node nor rls ???')
        }
        return tx.run(query)
      })
      const p = res.records[0].get('n')

      // Close the sesssion
      await session.close()

      // Return the properties of the node
      console.log(p)
      return p.properties
    }
  },
  mounted() {
    document.getElementById('graph-div-error').remove()
    function resize(ev){
      var graph = document.getElementById('graph');
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const titleHeight = 0;
      graph.style.setProperty('height', `${windowHeight - titleHeight}px`)
      graph.style.setProperty('width', `${windowWidth }px`)
    }
    window.addEventListener('resize',resize);
    resize();
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
  margin: 0px;
  height: 10px;
  overflow: hidden;
}
.control-panel{
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background-color: antiquewhite;
}
.info-panel{
  width: 40%;
  position: absolute;
  top: 0;
  left: 60%;
  background-color: aliceblue;
}
body{
  width:100%;
  height:100%;
  margin:0;
}
</style>

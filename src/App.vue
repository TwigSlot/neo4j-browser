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
    <div v-if="dataPanel.labels" v-bind:id="dataPanel.id">
      <h3>{{dataPanel.objType}} Properties</h3>
      <ul>
        <li v-for="(label,index) in dataPanel.labels" :key="index" contenteditable="true" v-on:blur="onInputLabel" v-on:onfocus="onFocusLabel">{{label}}</li>
        <li v-if="dataPanel.objType == 'Node'"><input type='button' value='Add Label' onclick='document.addLabel()'/></li>
      </ul>
      <table>
        <tr>
          <th>&lt;id&gt;</th>
          <th>{{dataPanel.id}}</th>
        </tr>
        <!-- <p>{{dataPanel.properties}}</p> -->
        <tr v-for="(value, property) in dataPanel.properties" :key="value">
          <th contenteditable="true" v-on:blur="onInputPropertyName">
            {{property}}
          </th>
          <th v-bind:id="'valueOf'+property" contenteditable="true" v-on:blur="onInputPropertyValue">
            {{value}}
          </th>
        </tr>
        <tr><input type="button" value="Add Property"/></tr>
      </table>
    </div>
    <div v-else-if="dataPanel.objType">Creating {{dataPanel.objType}} in Neo4J... Hover over node again later to check</div>
    <div v-else>Hover over a node/edge to check it out</div>
  </div>
  <text id="graph-div-error">ERROR: This message will disappear when the graph div is resized appropriately.</text>
</template>
<script setup>

import neo4j, {session} from 'neo4j-driver'
const driver = neo4j.driver('bolt://3.236.153.45:7687',
  neo4j.auth.basic('neo4j', 'cake-multisystem-breads'))

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
document.query = async function(){
  const cypherQuery = document.getElementById('query-textarea').value;
  const session = driver.session({database: 'neo4j'});
  const tx = session.beginTransaction();
  
  const res = await tx.run(cypherQuery);

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
        newVertex.objInfo = field;
        newVertex.name = displayName;
      }else if(field.constructor.name == 'Relationship'){
        console.log(field)
        const s = field.start.toNumber().toString()
        const t = field.end.toNumber().toString()
        var newEdge = document.addEdge(s,t);
        newEdge.objInfo = field;
      }else if(field.constructor.name == 'Integer'){
        continue;
      }
    }
  })
  session.close();
}
document.addLabel = function(){
  dataPanel.value['labels'].push('NewLabel')
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
    const newEdge = document.addEdge(document.sourceNode,e.node)
    document.sourceNode = null;
    console.log(newEdge)

    const s = window.vue.nodes[newEdge.source].objInfo.identity.toNumber();
    const t = window.vue.nodes[newEdge.target].objInfo.identity.toNumber();
    const query = 'MATCH (a), (b) WHERE id(a)=$s AND id(b)=$t CREATE (a)-[e:Edge]->(b) RETURN e'

    await writeTransaction(query, {s:s, t:t}, 
      (res) => {
        newEdge.objInfo = res.records[0].get('e')
        updateDataPanel(newEdge.objInfo, newEdge) 
      });
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
  const query = "CREATE (n) SET n.name=$newName RETURN n"
  await window.vue.writeTransaction(query, {newName: newNode.name},
    (res) => {
      newNode.objInfo = res.records[0].get('n')
      updateDataPanel(newNode.objInfo)
    })
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
async function writeTransaction(query, params, callback){
  console.log(query, params)
  const session = document.driver.session({
    database: 'neo4j',
  })
  // Create a node within a write transaction
  const res = await session.writeTransaction(tx => {
    return tx.run(query, params)
  })
  // Close the sesssion
  session.close()
  if(callback) callback(res);
  console.log(res)
  console.log(res.records[0]._fields[0])
  return res
}
function updateDataPanel(objInfo, obj){
  console.log(obj)
  if(!objInfo) return;
  dataPanel.value = {}
  dataPanel.value['objType'] = objInfo.constructor.name
  if(obj){
    dataPanel.value['obj'] = obj
  }
  dataPanel.value['id'] = objInfo.identity.toNumber();
  dataPanel.value['properties'] = objInfo.properties;
  if(objInfo.constructor.name == 'Node'){
    dataPanel.value['labels'] = objInfo.labels;
  }else if(objInfo.constructor.name == 'Relationship'){
    dataPanel.value['labels'] = [objInfo.type];
  }else{
    console.log("NEITHER???")
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
          const obj = nodes[event.node]
          updateDataPanel(obj.objInfo, obj)
        } else if(type == 'node:pointerout'){
          // console.log('i')
        } else if(type == 'edge:pointerover'){
          const obj = edges[event.edge]
          updateDataPanel(obj.objInfo, obj)
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
 
    getPropertyNameValue(row){ // row is the row of the table
      const objId = parseInt(row.parentElement.parentElement.id); // id in neo4j
      return [objId, row.children[0].innerText, row.children[1].innerText];
    },
    async onInputPropertyName(e){
      let [objId, newPropertyName, _] = this.getPropertyNameValue(e.target.parentElement)
      console.log(e.target)
      var propertyIdx = Array.prototype.indexOf.call(e.target.parentElement.parentElement.children, e.target.parentElement)
      propertyIdx-=1; // for the <id> row which doesnt change
      const oldPropertyName = Object.keys(dataPanel.value['properties'])[propertyIdx]
      var query;
      if (dataPanel.value['objType'] == 'Relationship') {
        query = `MATCH (a)-[n]->(b) WHERE id(n)=$objId`
      }else if(dataPanel.value['objType'] == 'Node'){
        query = `MATCH (n) WHERE id(n)=$objId`
      }else{     
        console.log('neither node nor edge')
      }
      query += ` SET n.\`${newPropertyName}\`=n.\`${oldPropertyName}\` REMOVE n.\`${oldPropertyName}\` RETURN n`
      const curObj = dataPanel.value['obj']
      await writeTransaction(query, { objId: objId }, 
        (res)=>{
          curObj.objInfo = res.records[0].get('n')
          // console.log(curObj, dataPanel.value['obj'], 'ARE NOT NECESSARILY THE SAME')
          if(curObj == dataPanel.value['obj']) updateDataPanel(curObj.objInfo) 
        });
      // const p = res.records[0].get('n')
      // dataPanel.value['obj'].objInfo = p
    },
    async onInputPropertyValue(e){ // updated value of property
      // name and value of altered property
      let [objId, propertyName, propertyValue] = this.getPropertyNameValue(e.target.parentElement)
      console.log(propertyName, propertyValue, dataPanel.value['objType'], objId);
      var query;
      if (dataPanel.value['objType'] == 'Relationship') {
        query = `MATCH (a)-[n]->(b) WHERE id(n)=$objId`
      }else if(dataPanel.value['objType'] == 'Node'){
        query = `MATCH (n) WHERE id(n)=$objId`
      }else{
        console.log('neither node nor rls ???')
      }
      query += ` SET n.\`${propertyName}\`=$propertyValue RETURN n`
      const curObj = dataPanel.value['obj'];
      await writeTransaction(query, {objId: objId, propertyName: propertyName, propertyValue: propertyValue},
        (res) => {
          curObj.objInfo = res.records[0].get('n')
          if(curObj == dataPanel.value['obj']) updateDataPanel(curObj.objInfo);
        });
    },
   async onInputLabel(e){
      console.log(e.target);
      const labelIdx = Array.prototype.indexOf.call(e.target.parentElement.children, e.target)
      const oldLabel = dataPanel.value['labels'][labelIdx];
      var newLabel = e.target.textContent;
      console.log(oldLabel, newLabel);
      if(oldLabel == newLabel) return;
      const objId = parseInt(e.target.parentElement.parentElement.id);
      if(newLabel == ''){
        if(dataPanel.value['objType'] == 'Relationship'){
          newLabel = 'Edge'
        }else{
          const query = `MATCH (n) WHERE id(n)=$objId REMOVE n:\`${oldLabel}\` RETURN n`
          const curObj = dataPanel.value['obj']
          await writeTransaction(query, {objId: objId, oldLabel: oldLabel}, 
            (res) =>{
              curObj.objInfo = res.records[0].get('n')
              if(curObj == dataPanel.value['obj']) updateDataPanel(curObj.objInfo);
            });
          return;
        }
      }
      var query;
      if (dataPanel.value['objType'] == 'Relationship') {
        query = `MATCH (a)-[n2]->(b) WHERE id(n2)=$objId CREATE (a)-[n:\`${newLabel}\`]->(b) SET n=n2 WITH n,n2,a,b DELETE n2 RETURN a,n,b`
      }else if(dataPanel.value['objType'] == 'Node'){
        query = `MATCH (n) WHERE id(n)=$objId REMOVE n:\`${oldLabel}\` SET n:\`${newLabel}\` RETURN n`
      }else{
        console.log('neither node nor rls ???')
      }
      const curObj = dataPanel.value['obj']
      await writeTransaction(query, {objId: objId, newLabel: newLabel, oldLabel: oldLabel},
        (res) => {
          curObj.objInfo = res.records[0].get('n')
          if (curObj == dataPanel.value['obj']) updateDataPanel(curObj.objInfo);
        });
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

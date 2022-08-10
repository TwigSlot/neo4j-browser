import { createApp } from "vue"
import VNetworkGraph from "v-network-graph"
import "v-network-graph/lib/style.css"
import App from "./App.vue"
import 'bulma/css/bulma.css'

const app = createApp(App)

app.use(VNetworkGraph)

app.mount("#app")
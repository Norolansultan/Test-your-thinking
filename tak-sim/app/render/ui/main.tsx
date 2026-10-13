import { render } from "preact";
import "maplibre-gl/dist/maplibre-gl.css";
import { App } from "./App.js";

const root = document.getElementById("app")!;
render(<App />, root);

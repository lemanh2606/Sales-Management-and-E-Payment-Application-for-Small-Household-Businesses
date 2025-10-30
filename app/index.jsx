import "react-native-gesture-handler"; // Quan trọng: Phải import trên cùng
import { AppRegistry } from "react-native";

// Sửa dòng này: thêm ".jsx" vào
import App from "./src/App";

import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);
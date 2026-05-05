import { registerAppComponent } from "../core/app-registry";
import FileManager from "./FileManager";
import Terminal from "./Terminal";
import TextEditor from "./TextEditor";
import Settings from "./Settings";
import Calculator from "./Calculator";
import ImageViewer from "./ImageViewer";
import Browser from "./Browser";
import Notes from "./Notes";
import AppStore from "./AppStore";
import MediaPlayer from "./MediaPlayer";
import Shortcuts from "./Shortcuts";
import AIAssistant from "./AIAssistant";
import DeveloperPortal from "./DeveloperPortal";
import { registerDemoManifests } from "../manifests";

export function registerAllApps() {
  registerDemoManifests();
  registerAppComponent("com.cloudos.files", FileManager);
  registerAppComponent("com.cloudos.terminal", Terminal);
  registerAppComponent("com.cloudos.editor", TextEditor);
  registerAppComponent("com.cloudos.settings", Settings);
  registerAppComponent("com.cloudos.calculator", Calculator);
  registerAppComponent("com.cloudos.imageviewer", ImageViewer);
  registerAppComponent("com.cloudos.browser", Browser);
  registerAppComponent("com.cloudos.notes", Notes);
  registerAppComponent("com.cloudos.appstore", AppStore);
  registerAppComponent("com.cloudos.mediaplayer", MediaPlayer);
  registerAppComponent("com.cloudos.shortcuts", Shortcuts);
  registerAppComponent("com.cloudos.assistant", AIAssistant);
  registerAppComponent("com.cloudos.devportal", DeveloperPortal);
}

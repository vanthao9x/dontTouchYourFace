import "./App.css";
import React, {useEffect, useRef} from "react";
// import { Howl } from 'howler';
// import soundUrl from './assets/hey_sondn.mp3';
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";


// var sound = new Howl({
//   src: [soundUrl]
// });

// sound.play();

function App() {

  const videoRef = useRef(null);
  const streamRef = useRef(null); // Để lưu stream camera và cleanup khi cần
  const init = async () =>{
    console.log("init...");

    await tf.setBackend("webgl"); // Chọn backend
    await tf.ready();
    console.log("TensorFlow.js is ready!");

    await setUpCamera();
    console.log("set up camera success ...");

    // Create the classifier.
    const classifier = knnClassifier.create();
    const mobilenetModule = await mobilenet.load();

    console.log("set up all success ...");
    console.log("không chạm tay lên mặt và bấm train 1");

  }

  const setUpCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream; // Lưu stream để có thể cleanup sau này
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        return new Promise((resolve) => {
          videoRef.current.onloadeddata = () => resolve();
        });
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  useEffect(() => {
    init();

    // clean up
    return () => {
      console.log("cleanup...");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="App">
      <video ref={videoRef} className="video" autoPlay/>

      <div className="control">
        <button className="button" onClick={() => console.log("Play")}>Training 1</button>
        <button className="button" onClick={() => console.log("Pause")}>Training 2</button>
        <button className="button" onClick={() => console.log("Stop")}>Stop</button>
      </div>
    </div>
  );
}

export default App;
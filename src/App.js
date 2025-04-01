import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import { initNotifications, notify } from '@mycv/f8-notification';
import { Howl } from 'howler';
import soundUrl from './assets/hey_sondn.mp3';
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";

var sound = new Howl({
  src: [soundUrl]
});

const NOT_TOUCH_LABEL = "not_touch_your_face";
const TOUCHED_LABEL = "touched_your_face";
const TRAINNING_TIME = 50;
const TOUCHED_CONFIDENCE = 0.8;
function App() {
  const [touched, setTouched] = useState(false);
  const canPlaySound = useRef(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null); // Để lưu stream camera và cleanup khi cần
  const classifier = useRef(null);
  const mobilenetModule = useRef(null); //
  const init = async () => {
    console.log("init...");

    await tf.setBackend("webgl"); // Chọn backend
    await tf.ready();
    console.log("TensorFlow.js is ready!");

    await setUpCamera();
    console.log("set up camera success ...");

    // Create the classifier.
    classifier.current = knnClassifier.create();
    mobilenetModule.current = await mobilenet.load();

    console.log("set up all success ...");
    console.log("không chạm tay lên mặt và bấm train 1");

    initNotifications({ cooldown: 3000 });
  };

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

  const train = async (label) => {
    console.log(label);
    for (let i = 0; i < TRAINNING_TIME; i++) {
      console.log(`Progress ${parseInt(((i + 1) / TRAINNING_TIME) * 100)}%`);

      await trainning(label);
    }
    /**
     * Train máy cho khuôn mặt không chạm tay
     * bước 2 trainning máy cho khuôn mặt chạm tay
     * bước 3 lấy hình ảnh hiện taij và so sánh với data đã học trước đó
     */
  };

  const trainning = (label) => {
    return new Promise(async (resolve) => {
      const embedding = mobilenetModule.current.infer(videoRef.current, true);
      classifier.current.addExample(embedding, label);

      await sleep(1);
      resolve();
    });
  };

  /** trong function run
   * classifier.predictClass(
    input: tf.Tensor,
    k = 3
    ): Promise<{label: string, classIndex: number, confidences: {[classId: number]: number}}>;
  */

  const run = async () => {
    const embedding = mobilenetModule.current.infer(videoRef.current, true);
    const result = await classifier.current.predictClass(embedding);
    console.log("Label: ",result.label);
    console.log("Confidence: ",result.confidences);

    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE) 
      {
      console.log("Chạm tay lên mặt");
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }
      notify('Bỏ tay ra', { body: 'Bạn vừa chạm tay vào mặt!' });
      setTouched(true);
    }
    else {
      console.log("Không chạm tay lên mặt");
      setTouched(false);
    }

    await sleep(2);
    run();
  };

  const sleep = (seconds = 0) => {
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 100);
    });
  };

  useEffect(() => {
    init();

    sound.on('end', function(){
      canPlaySound.current = true;
    });

    // clean up
    return () => {
      console.log("cleanup...");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className={`App ${touched ? "touched" : "not-touched"}`}>
      <video ref={videoRef} className="video" autoPlay />

      <div className="control">
        <button        
          className="button"
          onClick={() => {
            train(NOT_TOUCH_LABEL);
          }}
        >
          Training 1
        </button>
        <button
          className="button"
          onClick={() => {
            train(TOUCHED_LABEL);
          }}
        >
          Training 2
        </button>
        <button
          className="button"
          onClick={() => {
            run();
          }}
        >
          Stop
        </button>
      </div>
    </div>
  );
}

export default App;
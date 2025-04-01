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
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1); // 1: initial, 2: after first training, 3: ready to run
  const [isTraining, setIsTraining] = useState(false);
  const [instruction, setInstruction] = useState("Không đưa tay vào màn hình và bấm Bắt đầu");
  const [setupDone, setSetupDone] = useState(false);
  
  const canPlaySound = useRef(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const classifier = useRef(null);
  const mobilenetModule = useRef(null);

  const init = async () => {
    console.log("init...");

    await tf.setBackend("webgl");
    await tf.ready();
    console.log("TensorFlow.js is ready!");

    await setUpCamera();
    console.log("set up camera success ...");

    classifier.current = knnClassifier.create();
    mobilenetModule.current = await mobilenet.load();

    setSetupDone(true);

    console.log("set up all success ...");
    setInstruction("Không chạm tay lên mặt, màn hình và bấm Bắt đầu");

    initNotifications({ cooldown: 3000 });
  };

  const setUpCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
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
    setIsTraining(true);
    setTrainingProgress(0);
    
    for (let i = 0; i < TRAINNING_TIME; i++) {
      const progress = Math.round(((i + 1) / TRAINNING_TIME) * 100);
      setTrainingProgress(progress);
      console.log(`Progress ${progress}%`);
      await trainning(label);
    }
    
    setIsTraining(false);
    
    if (label === NOT_TOUCH_LABEL) {
      setCurrentStep(2);
      setInstruction("Bây giờ để tay vào màn hình từ từ chạm tay lên mặt và bấm Training 2");
    } else if (label === TOUCHED_LABEL) {
      setCurrentStep(3);
      setInstruction("Training hoàn tất! Bấm Run để bắt đầu nhận diện, bạn có thể chuyển sang tab mới để thấy điều thú vị");
    }
  };

  const trainning = (label) => {
    return new Promise(async (resolve) => {
      const embedding = mobilenetModule.current.infer(videoRef.current, true);
      classifier.current.addExample(embedding, label);
      await sleep(1);
      resolve();
    });
  };

  const run = async () => {
    setCurrentStep(4);
    setInstruction("Hệ thống đang chạy...");
    
    const embedding = mobilenetModule.current.infer(videoRef.current, true);
    const result = await classifier.current.predictClass(embedding);
    
    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
    ) {
      console.log("Chạm tay lên mặt");
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }
      notify('Bỏ tay ra', { body: 'Bạn vừa chạm tay vào mặt!' });
      setTouched(true);
    } else {
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

    sound.on('end', function() {
      canPlaySound.current = true;
    });

    return () => {
      console.log("cleanup...");
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const getButtonText = () => {
    if (!setupDone){
      return "Processing...";
    }
    if (isTraining) {
      return `Training... ${trainingProgress}%`;
    }
    switch(currentStep) {
      case 1: return "Bắt đầu";
      case 2: return "Training 2";
      case 3: return "Run";
      default: return "";
    }
  };

  const handleButtonClick = () => {
    switch(currentStep) {
      case 1: return train(NOT_TOUCH_LABEL);
      case 2: return train(TOUCHED_LABEL);
      case 3: return run();
      default: return null;
    }
  };

  return (
    <div className={`App ${touched ? "touched" : "not-touched"}`}>
      <video ref={videoRef} className="video" autoPlay />
      
      <div className="instruction">{instruction}</div>
      
      <div className="control">
        <button
          className={`button ${isTraining ? "training" : ""}`}
          onClick={handleButtonClick}
          disabled={ (isTraining && currentStep !== 4 ) || !setupDone }
          style={isTraining ? {'--progress': `${trainingProgress}%`} : {}}
        >
          {getButtonText()}
        </button>
      </div>
    </div>
  );
}

export default App;
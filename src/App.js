import "./App.css";
import React, { useEffect, useRef, useState } from "react";
import { initNotifications, notify } from "@mycv/f8-notification";
import { Howl } from "howler";
import soundUrl from "./assets/hey_sondn.mp3";
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import * as knnClassifier from "@tensorflow-models/knn-classifier";

var sound = new Howl({
  src: [soundUrl],
});

const NOT_TOUCH_LABEL = "not_touch_your_face";
const TOUCHED_LABEL = "touched_your_face";
const TRAINNING_TIME = 50;
const TOUCHED_CONFIDENCE = 0.8;

function App() {
  const [cameraError, setCameraError] = useState(null); // Chỉ lưu trạng thái lỗi
  const [isImageEnlarged, setIsImageEnlarged] = useState(false);
  const [touched, setTouched] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [isTraining, setIsTraining] = useState(false);
  const [instruction, setInstruction] = useState(
    "Không đưa tay vào màn hình và bấm Bắt đầu"
  );
  const [setupDone, setSetupDone] = useState(false);

  const canPlaySound = useRef(true);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const classifier = useRef(null);
  const mobilenetModule = useRef(null);

  const handleImageClick = () => {
    setIsImageEnlarged(true);
  };

  const handleCloseImage = () => {
    setIsImageEnlarged(false);
  };

  const init = async () => {
    console.log("init...");

    await tf.setBackend("webgl");
    await tf.ready();
    console.log("TensorFlow.js is ready!");

    try {
      await setUpCamera();
      classifier.current = knnClassifier.create();
      mobilenetModule.current = await mobilenet.load();

      setSetupDone(true);
      console.log("set up all success ...");
      setInstruction("Không chạm tay lên mặt, màn hình và bấm Bắt đầu");
      initNotifications({ cooldown: 3000 });
    } catch (error) {
      console.error("Initialization error:", error);
      setCameraError("Không thể truy cập camera. Vui lòng cho phép quyền camera và tải lại trang.");
    }
  };

  const setUpCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        return new Promise((resolve, reject) => {
          const onLoaded = () => {
            if (stream.active && videoRef.current.readyState >= 2) {
              resolve();
            } else {
              reject(new Error("Camera stream không hoạt động"));
            }
          };
          
          videoRef.current.onloadeddata = onLoaded;
          
          setTimeout(() => {
            if (videoRef.current.readyState >= 2) {
              onLoaded();
            } else {
              reject(new Error("Camera mất quá nhiều thời gian để khởi động"));
            }
          }, 3000);
        });
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      setCameraError("Lỗi camera: " + error.message);
      throw error;
    }
  };

  const train = async (label) => {
    setIsTraining(true);
    setTrainingProgress(0);

    for (let i = 0; i < TRAINNING_TIME; i++) {
      const progress = Math.round(((i + 1) / TRAINNING_TIME) * 100);
      setTrainingProgress(progress);
      await trainning(label);
    }

    setIsTraining(false);

    if (label === NOT_TOUCH_LABEL) {
      setCurrentStep(2);
      setInstruction(
        "Bây giờ để tay vào màn hình từ từ chạm tay lên mặt và bấm Training 2"
      );
    } else if (label === TOUCHED_LABEL) {
      setCurrentStep(3);
      setInstruction("Training hoàn tất! Bấm Run để hệ thống giúp bạn");
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
    setInstruction(
      "Hệ thống đang chạy... Bạn có thể bật sang tab làm việc khác. Hệ thống sẽ nhắc nhở bạn"
    );

    const embedding = mobilenetModule.current.infer(videoRef.current, true);
    const result = await classifier.current.predictClass(embedding);

    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
    ) {
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }
      notify("Bỏ tay ra", { body: "Bạn vừa chạm tay vào mặt!" });
      setTouched(true);
    } else {
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

    sound.on("end", function () {
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
    if (cameraError) return "Lỗi Camera";
    if (!setupDone) return "Đang khởi tạo...";
    if (isTraining) return `Training... ${trainingProgress}%`;
    
    switch (currentStep) {
      case 1: return "Bắt đầu";
      case 2: return "Training 2";
      case 3: return "Run";
      default: return "Create by Văn Thảo - chúc bạn vui vẻ!";
    }
  };

  const handleButtonClick = () => {
    if (cameraError || !setupDone) return;
    
    switch (currentStep) {
      case 1: return train(NOT_TOUCH_LABEL);
      case 2: return train(TOUCHED_LABEL);
      case 3: return run();
      default: return null;
    }
  };

  return (
    <div className="container">
      <div>
        <img
          src="./Van-Thao.png"
          className="img-owner"
          alt="logo"
          onClick={handleImageClick}
        />
        <p>Văn Thảo - FULL STACK DEVELOPER</p>
      </div>
      
      {isImageEnlarged && (
        <div className="overlay" onClick={handleCloseImage}>
          <img src="./Van-Thao.png" className="enlarged-img" alt="logo" />
        </div>
      )}
      
      <div className={`App ${touched ? "touched" : "not-touched"}`}>
        <h1>Chào bạn đến với tiện ích nhắc nhở bạn</h1>
        <p>
          Nếu bạn thường xuyên có thói quen xấu như chống cằm, cắn móng tay khi
          làm việc
          <br /> Hãy bật hệ thống này để nhắc nhở Bạn
          <br /> Giúp bạn tránh đưa vi khuẩn lên mặt
        </p>
        
        {/* Chỉ hiển thị thông báo lỗi nếu có */}
        {cameraError && (
          <div className="camera-error">
            {cameraError}
            <button onClick={() => window.location.reload()} className="reload-btn">
              Tải lại trang
            </button>
          </div>
        )}
        
        <p style={{ color: "red" }}>
          {setupDone && currentStep === 1
            ? "không được đưa tay lên, nếu bạn làm sai phải refresh trang"
            : ""}
        </p>
        <p style={{ color: "green" }}>
          {currentStep === 2
            ? "PHẢI ĐƯA TAY LÊN màn hình, nếu bạn làm sai phải refresh trang"
            : ""}
        </p>

        <video ref={videoRef} className="video" autoPlay muted />

        <div className="instruction">{instruction}</div>

        <div className="control">
          <button
            className={`button ${isTraining ? "training" : ""}`}
            onClick={handleButtonClick}
            disabled={!!cameraError || (isTraining && currentStep !== 4) || !setupDone}
            style={isTraining ? { "--progress": `${trainingProgress}%` } : {}}
          >
            {getButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
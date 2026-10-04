"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INTRO_STORAGE_KEY = "findit_logo_intro_seen";
const INTRO_TIMEOUT_MS = 8000;
const INTRO_FADE_MS = 500;
const INTRO_VIDEO_PATH = "/logo-video/logo.mp4";

export function LogoIntro() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const finishIntro = useCallback(() => {
    if (isExiting || !isVisible) {
      return;
    }

    setIsExiting(true);

    window.setTimeout(() => {
      setIsVisible(false);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
      }

      if (videoRef.current) {
        videoRef.current.pause();
      }
    }, INTRO_FADE_MS);
  }, [isExiting, isVisible]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const shouldShowIntro = window.sessionStorage.getItem(INTRO_STORAGE_KEY) !== "true";
    setIsVisible(shouldShowIntro);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timeoutId = window.setTimeout(() => {
      finishIntro();
    }, INTRO_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
      document.body.style.overflow = originalOverflow;
    };
  }, [finishIntro, isVisible]);

  useEffect(() => {
    if (!isVisible || !videoRef.current) {
      return;
    }

    const video = videoRef.current;

    const handleCanPlay = () => {
      video.play().catch(() => {
        finishIntro();
      });
    };

    const handleError = () => {
      finishIntro();
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("error", handleError);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("error", handleError);
    };
  }, [finishIntro, isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`logo-intro ${isExiting ? "logo-intro--hidden" : ""}`}
      aria-live="polite"
      aria-label="FindIt introduction"
    >
      <video
        ref={videoRef}
        className="logo-intro__video"
        src={INTRO_VIDEO_PATH}
        autoPlay
        muted
        playsInline
        loop={false}
        preload="auto"
        controls={false}
        disablePictureInPicture
        onEnded={finishIntro}
        onError={finishIntro}
      />
    </div>
  );
}

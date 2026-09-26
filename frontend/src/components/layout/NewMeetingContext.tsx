"use client";

import { createContext, useContext } from "react";

export type NewMeetingTab = "upload" | "paste" | "form";

export const NewMeetingContext = createContext<(tab?: NewMeetingTab) => void>(() => {});

export const useOpenNewMeeting = () => useContext(NewMeetingContext);

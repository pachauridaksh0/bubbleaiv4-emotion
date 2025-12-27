
import React, { useState, useRef, useEffect } from 'react';

// This component now acts as a utility hook wrapper or simple headless component
// logic, as the UI button has been moved into ChatInput.tsx for better integration.
export const VoiceControls: React.FC<{ onTranscript: (text: string) => void }> = ({ onTranscript }) => {
  // Logic is now duplicated/moved to ChatInput.tsx to allow for the UI swap.
  // Keeping this file as a placeholder if other components import it to prevent breakage,
  // but it renders nothing to avoid double buttons.
  return null; 
};

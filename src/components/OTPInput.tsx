
import React, { useRef, useEffect } from 'react';
import { Label } from "@/components/ui/label";

interface OTPInputProps {
  length: number;
  value: string;
  onChange: (value: string) => void;
}

const OTPInput = ({ length, value, onChange }: OTPInputProps) => {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  
  // Pre-fill the refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, length);
  }, [length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newValue = e.target.value;
    
    // Only accept single digits
    if (newValue.length > 1) {
      e.target.value = newValue.slice(0, 1);
    }
    
    // Update the value
    const otpArray = value.split('');
    otpArray[index] = e.target.value;
    const newOtp = otpArray.join('');
    onChange(newOtp);
    
    // Move to next input if current input is filled
    if (newValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Move to previous input on backspace if current input is empty
    if (e.key === 'Backspace' && !e.currentTarget.value && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, length).split('');
    
    if (pasteData) {
      const otpArray = Array(length).fill('');
      pasteData.forEach((char, idx) => {
        if (idx < length) otpArray[idx] = char;
      });
      onChange(otpArray.join(''));
      
      // Focus the next empty input or the last one
      const lastIndex = Math.min(pasteData.length, length - 1);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="otp-input" className="text-sm font-medium text-gray-700">
        Verification code
      </Label>
      <div className="flex justify-center gap-2">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(e, index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            onPaste={handlePaste}
            className="w-12 h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
          />
        ))}
      </div>
    </div>
  );
};

export default OTPInput;

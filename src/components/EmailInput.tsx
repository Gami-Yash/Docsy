
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmailInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}

const EmailInput = ({ value, onChange, error }: EmailInputProps) => {
  return (
    <div className="space-y-2">
      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
        Email address
      </Label>
      <Input
        id="email"
        type="email"
        placeholder="you@example.com"
        value={value}
        onChange={onChange}
        className={`h-12 px-4 border ${
          error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-purple-500'
        } rounded-lg focus:ring-2 transition-all duration-200`}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default EmailInput;

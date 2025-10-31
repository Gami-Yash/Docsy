import React from 'react';

const Logo = () => {
  return (
    <div className="flex items-center justify-center mb-6">
      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
        <span className="text-white text-xl font-bold">D</span>
      </div>
      <span className="ml-3 text-2xl font-bold text-gray-800">Docsy</span>
    </div>
  );
};

export default Logo;

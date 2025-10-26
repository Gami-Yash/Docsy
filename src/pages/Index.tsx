
import React from 'react';
import Logo from '../components/Logo';
import AuthForm from '../components/AuthForm';

const Index = () => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 to-white flex flex-col items-center justify-center p-4">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none"></div>
      
      <div className="relative w-full max-w-md flex flex-col items-center z-10">
        <Logo />
        <AuthForm />
        
        <p className="mt-8 text-center text-xs text-gray-500">
          By continuing, you agree to our <a href="#" className="text-purple-600 hover:underline">Terms of Service</a> and <a href="#" className="text-purple-600 hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
};

export default Index;

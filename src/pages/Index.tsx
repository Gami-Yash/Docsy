import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useAuthForm } from '../components/auth/useAuthForm';
import AuthForm from '../components/AuthForm';

const Index = () => {
  const auth = useAuthForm();

  const layoutVariants: Variants = {
    initial: (isRegistering: boolean) => ({
      x: isRegistering ? "100%" : "-100%",
      opacity: 0,
    }),
    animate: {
      x: "0%",
      opacity: 1,
      transition: { duration: 0.5, ease: "easeInOut" },
    },
    exit: (isRegistering: boolean) => ({
      x: isRegistering ? "-100%" : "100%",
      opacity: 0,
      transition: { duration: 0.5, ease: "easeInOut" },
    }),
  };

  const illustration = (
    <div className="w-full lg:w-1/2 flex items-center justify-center p-12 bg-[#ecfff2]">
      <div className="text-center">
        <motion.img
          key={auth.isRegistering ? 'register-img' : 'login-img'}
          src={auth.isRegistering ? "/LoginPage2.png" : "/LoginPage1.png"}
          alt="Document analysis"
          className="max-w-sm mx-auto mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
        <h1 className="text-3xl font-bold text-gray-800 mb-3">Unlock Insights from Your Documents</h1>
        <p className="text-gray-600 max-w-md mx-auto">
          Chat with any PDF, get summaries, ask questions, and find information instantly. Docsy makes your documents interactive.
        </p>
      </div>
    </div>
  );

  const authForm = (
    <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] pointer-events-none lg:hidden"></div>
      <div className="w-full max-w-md z-10">
        <AuthForm {...auth} />
        <p className="mt-8 text-center text-xs text-gray-500">
          By continuing, you agree to our <a href="#" className="text-primary hover:underline">Terms of Service</a> and <a href="#" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#ecfff2] flex flex-col lg:flex-row overflow-hidden">
      <AnimatePresence initial={false} custom={auth.isRegistering} mode="wait">
        <motion.div
          key={auth.isRegistering ? "register" : "login"}
          className="flex w-full"
          custom={auth.isRegistering}
          variants={layoutVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          {auth.isRegistering ? (
            <>
              {authForm}
              {illustration}
            </>
          ) : (
            <>
              {illustration}
              {authForm}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default Index;

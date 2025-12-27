
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthPage } from './AuthPage';

interface AuthOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ isOpen, onClose }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    {...{
                      initial: { opacity: 0 },
                      animate: { opacity: 1 },
                      exit: { opacity: 0 },
                    }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <div onClick={(e) => e.stopPropagation()}>
                        <AuthPage />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

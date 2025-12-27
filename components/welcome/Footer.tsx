
import React from 'react';

export const Footer: React.FC = () => (
     <footer className="w-full py-12 px-8 border-t border-white/10 bg-black">
        <div className="container mx-auto grid md:grid-cols-4 gap-8 text-left">
            <div className="col-span-1 md:col-span-1">
                 <div className="flex items-center space-x-2.5 mb-6">
                    <span className="text-2xl">🫧</span>
                    <span className="text-xl font-bold tracking-wider text-white">Bubble</span>
                </div>
                <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Bubble Inc.<br/>All rights reserved.</p>
            </div>
            <div>
                <h4 className="font-bold text-white mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li><a href="#" className="hover:text-primary-start transition-colors">Features</a></li>
                    <li><a href="#" className="hover:text-primary-start transition-colors">Pricing</a></li>
                    <li><a href="#" className="hover:text-primary-start transition-colors">Changelog</a></li>
                </ul>
            </div>
             <div>
                <h4 className="font-bold text-white mb-4">Company</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li><a href="#" className="hover:text-primary-start transition-colors">About</a></li>
                    <li><a href="#" className="hover:text-primary-start transition-colors">Careers</a></li>
                    <li><a href="#" className="hover:text-primary-start transition-colors">Blog</a></li>
                </ul>
            </div>
             <div>
                <h4 className="font-bold text-white mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-gray-400">
                    <li><a href="#" className="hover:text-primary-start transition-colors">Privacy</a></li>
                    <li><a href="#" className="hover:text-primary-start transition-colors">Terms</a></li>
                </ul>
            </div>
        </div>
    </footer>
);

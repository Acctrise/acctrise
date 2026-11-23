"use client";

import Link from "next/link";
import { Home, Search, RotateCcw, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found-page min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Animated background elements */}
        <div className="not-found-bg" aria-hidden="true">
          <div className="not-found-orb orb-1" />
          <div className="not-found-orb orb-2" />
          <div className="not-found-orb orb-3" />
        </div>

        {/* Error code */}
        <div className="relative z-10 mb-8">
          <span className="not-found-code">404</span>
          <div className="not-found-sparkles" aria-hidden="true">
            <Sparkles className="sparkle-1" size={20} />
            <Sparkles className="sparkle-2" size={16} />
            <Sparkles className="sparkle-3" size={12} />
            <Sparkles className="sparkle-4" size={18} />
          </div>
        </div>

        {/* Message */}
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-description">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          No worries — let&apos;s get you back on track.
        </p>

        {/* Action buttons */}
        <div className="not-found-actions mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="not-found-btn not-found-btn-primary"
          >
            <Home className="h-5 w-5" aria-hidden="true" />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="not-found-btn not-found-btn-secondary"
          >
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
            Back to Home
          </Link>
        </div>

        {/* Helpful links */}
        <nav className="not-found-links mt-10" aria-label="Quick links">
          <p className="not-found-links-label">Quick links</p>
          <div className="not-found-links-grid mt-4">
            <Link href="/dashboard/boosting" className="not-found-link">
              <Search className="h-4 w-4" aria-hidden="true" />
              Boost Services
            </Link>
            <Link href="/dashboard/rent-number" className="not-found-link">
              <Search className="h-4 w-4" aria-hidden="true" />
              Rent a Number
            </Link>
            <Link href="/dashboard/wallet" className="not-found-link">
              <Search className="h-4 w-4" aria-hidden="true" />
              Fund Wallet
            </Link>
            <Link href="/dashboard/orders" className="not-found-link">
              <Search className="h-4 w-4" aria-hidden="true" />
              My Orders
            </Link>
          </div>
        </nav>

        {/* Support contact */}
        <div className="not-found-support mt-10 pt-8 border-t border-slate-200">
          <p className="not-found-support-text">
            Still can&apos;t find what you need?
            <a href="mailto:support@acctrise.com" className="not-found-support-link">
              Contact support
            </a>
          </p>
        </div>
      </div>

      <style jsx>{`
        .not-found-page {
          background:
            radial-gradient(circle at 10% 10%, rgba(35, 199, 255, 0.18), transparent 35%),
            radial-gradient(circle at 90% 90%, rgba(244, 87, 173, 0.14), transparent 35%),
            linear-gradient(135deg, #f4f7ff 0%, #ffffff 50%, #f7efff 100%);
        }

        .not-found-bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          overflow: hidden;
          pointer-events: none;
        }

        .not-found-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.5;
          animation: float 20s ease-in-out infinite;
        }

        .orb-1 {
          width: 300px;
          height: 300px;
          top: -100px;
          left: -100px;
          background: linear-gradient(135deg, #246bfe, #6d5dfc);
          animation-delay: 0s;
        }

        .orb-2 {
          width: 240px;
          height: 240px;
          bottom: -80px;
          right: -80px;
          background: linear-gradient(135deg, #f457ad, #ff9f43);
          animation-delay: -7s;
        }

        .orb-3 {
          width: 180px;
          height: 180px;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #12b7f5, #18b989);
          animation-delay: -14s;
        }

        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 30px) scale(0.95); }
        }

        .not-found-code {
          display: inline-block;
          font-size: clamp(120px, 25vw, 200px);
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
          background: linear-gradient(135deg, #246bfe, #6d5dfc 50%, #f457ad);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-fill-color: transparent;
          filter: drop-shadow(0 20px 40px rgba(36, 107, 254, 0.25));
        }

        .not-found-sparkles {
          position: absolute;
          inset: -20px;
          pointer-events: none;
        }

        .not-found-sparkles .sparkle-1 {
          position: absolute;
          top: 10%;
          left: 5%;
          color: #246bfe;
          animation: sparkle 2s ease-in-out infinite;
        }

        .not-found-sparkles .sparkle-2 {
          position: absolute;
          top: 20%;
          right: 8%;
          color: #f457ad;
          animation: sparkle 2s ease-in-out infinite 0.3s;
        }

        .not-found-sparkles .sparkle-3 {
          position: absolute;
          bottom: 15%;
          left: 10%;
          color: #12b7f5;
          animation: sparkle 2s ease-in-out infinite 0.6s;
        }

        .not-found-sparkles .sparkle-4 {
          position: absolute;
          bottom: 10%;
          right: 5%;
          color: #18b989;
          animation: sparkle 2s ease-in-out infinite 0.9s;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0.3; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
        }

        .not-found-title {
          margin-top: 16px;
          font-size: clamp(28px, 5vw, 40px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #25304e;
        }

        .not-found-description {
          margin-top: 12px;
          font-size: 16px;
          line-height: 1.65;
          color: #64708e;
          max-width: 420px;
          margin-left: auto;
          margin-right: auto;
        }

        .not-found-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 52px;
          padding: 0 28px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0;
          transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease;
          white-space: nowrap;
        }

        .not-found-btn:hover {
          transform: translateY(-2px);
        }

        .not-found-btn:active {
          transform: translateY(0);
        }

        .not-found-btn-primary {
          color: white;
          background: linear-gradient(135deg, #246bfe, #6d5dfc);
          box-shadow: 0 14px 34px rgba(36, 107, 254, 0.28);
        }

        .not-found-btn-primary:hover {
          box-shadow: 0 20px 40px rgba(36, 107, 254, 0.35);
        }

        .not-found-btn-secondary {
          color: #2d3858;
          background: white;
          border: 1px solid rgba(47, 58, 96, 0.12);
          box-shadow: 0 12px 30px rgba(39, 50, 95, 0.1);
        }

        .not-found-btn-secondary:hover {
          background: #f6f8ff;
          border-color: rgba(36, 107, 254, 0.2);
        }

        .not-found-links {
          text-align: center;
        }

        .not-found-links-label {
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #64708e;
        }

        .not-found-links-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          max-width: 360px;
          margin: 0 auto;
        }

        .not-found-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 18px;
          border-radius: 14px;
          background: white;
          border: 1px solid rgba(47, 58, 96, 0.08);
          font-size: 14px;
          font-weight: 700;
          color: #394462;
          transition: all 150ms ease;
        }

        .not-found-link:hover {
          background: #eef3ff;
          border-color: rgba(36, 107, 254, 0.2);
          color: #1f48c6;
          transform: translateY(-1px);
          box-shadow: 0 8px 20px rgba(36, 107, 254, 0.12);
        }

        .not-found-support {
          text-align: center;
        }

        .not-found-support-text {
          font-size: 14px;
          color: #64708e;
        }

        .not-found-support-link {
          color: #246bfe;
          font-weight: 800;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 150ms ease;
        }

        .not-found-support-link:hover {
          border-color: #246bfe;
        }

        @media (max-width: 480px) {
          .not-found-links-grid {
            grid-template-columns: 1fr;
          }

          .not-found-actions {
            flex-direction: column;
            width: 100%;
          }

          .not-found-btn {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}
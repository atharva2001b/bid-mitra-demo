"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Eye, EyeOff } from "lucide-react";

type LLMProvider = "cdac" | "gemini";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    sms: false,
  });

  const [preferences, setPreferences] = useState({
    theme: "light",
    language: "en",
    timezone: "Asia/Kolkata",
  });

  // LLM Configuration
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("cdac");
  const [cdacApiKey, setCdacApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showCdacKey, setShowCdacKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Load LLM settings from localStorage on mount
  useEffect(() => {
    const savedProvider = localStorage.getItem("llm_provider") as LLMProvider | null;
    const savedCdacKey = localStorage.getItem("cdac_api_key") || "";
    const savedGeminiKey = localStorage.getItem("gemini_api_key") || "";

    if (savedProvider) {
      setLlmProvider(savedProvider);
    }
    setCdacApiKey(savedCdacKey);
    setGeminiApiKey(savedGeminiKey);
  }, []);

  const handleSaveLLMSettings = () => {
    setSaveStatus("saving");
    
    // Save to localStorage
    localStorage.setItem("llm_provider", llmProvider);
    localStorage.setItem("cdac_api_key", cdacApiKey);
    localStorage.setItem("gemini_api_key", geminiApiKey);
    
    // Also set as environment variables (for runtime access)
    if (typeof window !== "undefined") {
      (window as any).__LLM_PROVIDER__ = llmProvider;
      (window as any).__CDAC_API_KEY__ = cdacApiKey;
      (window as any).__GEMINI_API_KEY__ = geminiApiKey;
    }

    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-slate-500">Manage your account settings and preferences</p>
        </header>

        {/* Account Settings */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Account Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Display Name</label>
              <input
                type="text"
                defaultValue="Shivaji Jadhav"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
              <input
                type="email"
                defaultValue="sdjad@wrd.com"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
              <input
                type="tel"
                defaultValue="+91 98765 43210"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Save Changes
            </button>
          </div>
        </section>

        {/* Preferences */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Preferences</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Theme</label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Language</label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Timezone</label>
              <select
                value={preferences.timezone}
                onChange={(e) => setPreferences({ ...preferences, timezone: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Notification Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">Email Notifications</div>
                <div className="text-xs text-slate-500">Receive updates via email</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">Push Notifications</div>
                <div className="text-xs text-slate-500">Receive browser push notifications</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.push}
                  onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">SMS Notifications</div>
                <div className="text-xs text-slate-500">Receive important updates via SMS</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.sms}
                  onChange={(e) => setNotifications({ ...notifications, sms: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </section>

        {/* LLM Configuration */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">LLM Configuration</h2>
          <p className="text-sm text-slate-500 mb-6">Configure your Large Language Model provider and API keys</p>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">LLM Provider</label>
              <Select value={llmProvider} onValueChange={(value) => setLlmProvider(value as LLMProvider)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select LLM Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cdac">CDAC GPT OSS</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {llmProvider === "cdac" 
                  ? "CDAC GPT OSS uses Bearer token authentication"
                  : "Google Gemini uses API key authentication"}
              </p>
            </div>

            {llmProvider === "cdac" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  CDAC API Key (Bearer Token)
                </label>
                <div className="relative">
                  <Input
                    type={showCdacKey ? "text" : "password"}
                    value={cdacApiKey}
                    onChange={(e) => setCdacApiKey(e.target.value)}
                    placeholder="Enter your CDAC Bearer token"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCdacKey(!showCdacKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showCdacKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  This will be used as Authorization: Bearer token in API requests
                </p>
              </div>
            )}

            {llmProvider === "gemini" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Gemini API Key
                </label>
                <div className="relative">
                  <Input
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter your Google Gemini API key"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Get your API key from Google AI Studio
                </p>
              </div>
            )}

            <Button
              onClick={handleSaveLLMSettings}
              disabled={saveStatus === "saving" || (llmProvider === "cdac" && !cdacApiKey.trim()) || (llmProvider === "gemini" && !geminiApiKey.trim())}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveStatus === "saving" 
                ? "Saving..." 
                : saveStatus === "saved" 
                ? "Saved!" 
                : "Save LLM Settings"}
            </Button>
            {saveStatus === "saved" && (
              <p className="text-sm text-green-600">Settings saved successfully!</p>
            )}
          </div>
        </section>

        {/* Security */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Security</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Current Password</label>
              <input
                type="password"
                placeholder="Enter current password"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
              <input
                type="password"
                placeholder="Enter new password"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Confirm New Password</label>
              <input
                type="password"
                placeholder="Confirm new password"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Update Password
            </button>
          </div>
        </section>

        {/* Bid Evaluation Data Management */}
        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Bid Evaluation Data</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-slate-900 mb-2">Reset to Default Correct Values</div>
              <div className="text-xs text-slate-500 mb-3">
                Reset the bid evaluation JSON data to the default correct partner values (Abhiraj, Shraddha, Shankar). This will restore the original annual turnover values from the extracted table.
              </div>
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  if (confirm("Are you sure you want to reset the evaluation data to default correct values? This will overwrite any changes you've made.")) {
                    try {
                      const response = await fetch("/api/bid-evaluation", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "resetToDefault" })
                      })
                      if (response.ok) {
                        alert("Evaluation data has been reset to default correct values! Please refresh the page to see the changes.")
                      } else {
                        const error = await response.json()
                        alert(`Failed to reset evaluation data: ${error.error || "Unknown error"}`)
                      }
                    } catch (error) {
                      console.error("Error resetting data:", error)
                      alert("Error resetting evaluation data.")
                    }
                  }
                }}
              >
                Reset to Default Values
              </Button>
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900 mb-2">Reset to Template</div>
              <div className="text-xs text-slate-500 mb-3">
                Reset the bid evaluation JSON data to the default template. This will clear all validation and evaluation data.
              </div>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (confirm("Are you sure you want to reset the evaluation data to template? This action cannot be undone.")) {
                    try {
                      const response = await fetch("/api/bid-evaluation", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "reset" })
                      })
                      if (response.ok) {
                        alert("Evaluation data has been reset to template! Please refresh the page to see the changes.")
                      } else {
                        const error = await response.json()
                        alert(`Failed to reset evaluation data: ${error.error || "Unknown error"}`)
                      }
                    } catch (error) {
                      console.error("Error resetting data:", error)
                      alert("Error resetting evaluation data.")
                    }
                  }
                }}
              >
                Reset to Template
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-red-900 mb-2">Delete Account</div>
              <div className="text-xs text-red-700 mb-3">Once you delete your account, there is no going back. Please be certain.</div>
              <button className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}


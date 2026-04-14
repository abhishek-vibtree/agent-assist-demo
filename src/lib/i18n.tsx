"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "en" | "ja";

const translations = {
  en: {
    // Sidebar
    conversations: "Conversations",
    knowledgebase: "Knowledgebase",
    wallet: "Wallet",
    notifications: "Notifications",

    // Call list panel
    calls: "Calls",
    noAnswer: "No answer",
    customerSupport: "Customer support",

    // Chat area
    selectCallToView: "Select a call to view",
    noCallHistoryYet: "No call history yet",

    // Customer profile
    info: "Info",
    firstName: "First Name",
    lastName: "Last Name",
    emailAddress: "Email Address",
    dateOfBirth: "Date of Birth",
    gender: "Gender",
    orderHistory: "Order History",
    noOrdersYet: "No orders yet",
    notes: "Notes",
    noNotesYet: "No notes yet",
    seeAllNotes: "See all notes",
    addresses: "Addresses",
    noAddressesAdded: "No addresses added",
    edit: "Edit",
    delete: "Delete",

    // Floating CTA
    makeACall: "Make a call",

    // Call popup
    liveCall: "Live Call",
    makeACallTitle: "Make a Call",
    live: "Live",
    ready: "Ready",
    connecting: "Connecting...",
    ringing: "Ringing...",
    connected: "Connected",
    callEnded: "Call Ended",
    error: "Error",
    enterPhoneNumber: "Enter phone number",
    unknown: "Unknown",
    listeningForSpeech: "Listening for speech...",
    mute: "Mute",
    unmute: "Unmute",
    keypad: "Keypad",
    aiAgentAssist: "AI Agent Assist",
    aiAssist: "AI Assist",
    clickAiButton: "Click the AI button or ask a question below to get suggestions.",
    askAiAboutCall: "Ask AI about this call...",
    thinking: "Thinking...",
    reason: "Reason",
    transcription: "Transcription",

    // Knowledge base
    knowledgeBaseTitle: "Knowledge Base",
    knowledgeBaseDesc: "Upload documents for AI Agent Assist to reference during calls.",
    upload: "Upload",
    searchFiles: "Search files...",
    dropFilesHere: "Drop files here to upload",
    uploadingFiles: "Uploading files...",
    noFilesUploadedYet: "No files uploaded yet",
    noFilesMatchSearch: "No files match your search",
    tryDifferentSearch: "Try a different search term",
    dragAndDropFiles: "Drag & drop files here or click Upload",
    uploadFiles: "Upload Files",
    name: "Name",
    size: "Size",
    uploaded: "Uploaded",
    actions: "Actions",
    download: "Download",
    dismiss: "Dismiss",
    file: "file",
    files: "files",
  },
  ja: {
    // Sidebar
    conversations: "会話",
    knowledgebase: "ナレッジベース",
    wallet: "ウォレット",
    notifications: "通知",

    // Call list panel
    calls: "通話",
    noAnswer: "応答なし",
    customerSupport: "カスタマーサポート",

    // Chat area
    selectCallToView: "通話を選択して表示",
    noCallHistoryYet: "通話履歴はまだありません",

    // Customer profile
    info: "情報",
    firstName: "名",
    lastName: "姓",
    emailAddress: "メールアドレス",
    dateOfBirth: "生年月日",
    gender: "性別",
    orderHistory: "注文履歴",
    noOrdersYet: "注文はまだありません",
    notes: "メモ",
    noNotesYet: "メモはまだありません",
    seeAllNotes: "すべてのメモを見る",
    addresses: "住所",
    noAddressesAdded: "住所が追加されていません",
    edit: "編集",
    delete: "削除",

    // Floating CTA
    makeACall: "電話をかける",

    // Call popup
    liveCall: "通話中",
    makeACallTitle: "電話をかける",
    live: "ライブ",
    ready: "準備完了",
    connecting: "接続中...",
    ringing: "呼び出し中...",
    connected: "接続済み",
    callEnded: "通話終了",
    error: "エラー",
    enterPhoneNumber: "電話番号を入力",
    unknown: "不明",
    listeningForSpeech: "音声を検出中...",
    mute: "ミュート",
    unmute: "ミュート解除",
    keypad: "キーパッド",
    aiAgentAssist: "AIエージェントアシスト",
    aiAssist: "AIアシスト",
    clickAiButton: "AIボタンをクリックするか、下に質問を入力して提案を受けてください。",
    askAiAboutCall: "この通話についてAIに質問...",
    thinking: "考え中...",
    reason: "理由",
    transcription: "文字起こし",

    // Knowledge base
    knowledgeBaseTitle: "ナレッジベース",
    knowledgeBaseDesc: "AIエージェントアシストが通話中に参照するドキュメントをアップロードしてください。",
    upload: "アップロード",
    searchFiles: "ファイルを検索...",
    dropFilesHere: "ここにファイルをドロップしてアップロード",
    uploadingFiles: "ファイルをアップロード中...",
    noFilesUploadedYet: "ファイルはまだアップロードされていません",
    noFilesMatchSearch: "検索に一致するファイルがありません",
    tryDifferentSearch: "別の検索語を試してください",
    dragAndDropFiles: "ファイルをドラッグ＆ドロップするか、アップロードをクリック",
    uploadFiles: "ファイルをアップロード",
    name: "名前",
    size: "サイズ",
    uploaded: "アップロード日",
    actions: "操作",
    download: "ダウンロード",
    dismiss: "閉じる",
    file: "ファイル",
    files: "ファイル",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

// Content translations for dynamic database values
const contentTranslations: Record<string, string> = {
  // Labels / Tags
  "Urgent": "緊急",
  "Lead": "リード",
  "New": "新規",
  "Trial": "トライアル",
  "VIP": "VIP",
  "Sales": "セールス",
  "Demo": "デモ",
  "Ref": "紹介",
  "Support": "サポート",
  "Escalation": "エスカレーション",
  "Enterprise": "エンタープライズ",
  "Billing": "請求",
  "Label": "ラベル",

  // Order statuses
  "Delivered": "配達済み",
  "Shipped": "発送済み",
  "Processing": "処理中",
  "Refund Requested": "返金リクエスト",
  "Cancelled": "キャンセル",

  // Product names
  "Standing Desk Converter": "スタンディングデスクコンバーター",
  "Ergonomic Keyboard": "エルゴノミクスキーボード",
  "Monitor Light Bar": "モニターライトバー",
  "Wireless Mouse Pro": "ワイヤレスマウスプロ",
  "USB-C Hub": "USB-Cハブ",
  "Laptop Stand": "ノートPCスタンド",
  "Webcam HD": "ウェブカメラHD",
  "Desk Organizer": "デスクオーガナイザー",

  // Gender
  "Female": "女性",
  "Male": "男性",
  "Other": "その他",
  "Men": "男性",

  // Notes content
  "Billing dispute — needs resolution within 48 hours.": "請求に関する紛争 — 48時間以内に解決が必要です。",
  "Customer frustrated about double charge. Escalated to billing team.": "お客様が二重請求に不満を持っています。請求チームにエスカレーションしました。",
  "Prefers email communication over phone calls.": "電話よりもメールでの連絡を希望しています。",
  "VIP customer — handle with priority.": "VIP顧客 — 優先対応してください。",
  "Requested callback after 3 PM.": "午後3時以降のコールバックを希望しています。",
  "Follow up on refund status next week.": "来週返金状況をフォローアップしてください。",
  "Customer requested product demo for team.": "お客様がチーム向けの製品デモを希望しています。",
  "Interested in enterprise plan upgrade.": "エンタープライズプランへのアップグレードに興味があります。",
  "Issue with keyboard connectivity resolved.": "キーボードの接続問題が解決しました。",
  "Needs invoice copy for reimbursement.": "経費精算のための請求書コピーが必要です。",
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  tc: (text: string) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("locale") as Locale) || "en";
    }
    return "en";
  });

  const handleSetLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", newLocale);
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[locale][key] || translations.en[key] || key;
    },
    [locale]
  );

  const tc = useCallback(
    (text: string): string => {
      if (locale === "en") return text;
      return contentTranslations[text] || text;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t, tc }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export type CallEntry = {
  id: string;
  name: string;
  initials: string;
  time: string;
  direction: "outgoing" | "incoming";
  status: "connected" | "missed" | "no_answer";
  duration: string;
  labels: { text: string; color: string }[];
};

export type CallLog = {
  id: string;
  name: string;
  phone: string;
  direction: "outgoing" | "incoming";
  status: "connected" | "missed";
  duration: string;
  hasRecording: boolean;
  labels: { text: string; color: string }[];
  note?: string;
  agent?: string;
  time: string;
};

export type ContactInfo = {
  name: string;
  username: string;
  phone: string;
  initials: string;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  gender: string;
  addresses: string[];
  notes: { text: string; author: string; date: string; time: string }[];
};

export const callEntries: CallEntry[] = [
  {
    id: "1",
    name: "Pratik Jadhav",
    initials: "PJ",
    time: "8:29 pm",
    direction: "outgoing",
    status: "connected",
    duration: "0:45 s",
    labels: [
      { text: "Sales", color: "blue" },
      { text: "New", color: "green" },
      { text: "VIP", color: "yellow" },
    ],
  },
  {
    id: "2",
    name: "Suman",
    initials: "S",
    time: "8:29 pm",
    direction: "outgoing",
    status: "missed",
    duration: "No answer",
    labels: [
      { text: "Urgent", color: "red" },
      { text: "Lead", color: "gray" },
    ],
  },
  {
    id: "3",
    name: "+91 9876543210",
    initials: "91",
    time: "8:29 pm",
    direction: "outgoing",
    status: "connected",
    duration: "2m",
    labels: [],
  },
  {
    id: "4",
    name: "Kishor Talapade",
    initials: "KT",
    time: "05/08/23",
    direction: "outgoing",
    status: "connected",
    duration: "0:45 s",
    labels: [
      { text: "Lead", color: "gray" },
      { text: "Demo", color: "purple" },
      { text: "Trial", color: "teal" },
      { text: "VIP", color: "yellow" },
      { text: "Ref", color: "pink" },
      { text: "New", color: "cyan" },
    ],
  },
  {
    id: "5",
    name: "+91 9876543210",
    initials: "91",
    time: "05/08/23",
    direction: "outgoing",
    status: "missed",
    duration: "No answer",
    labels: [{ text: "Urgent", color: "red" }],
  },
];

export const callLogs: CallLog[] = [
  {
    id: "log1",
    name: "Kishor Talapade",
    phone: "+91 9876543210",
    direction: "incoming",
    status: "missed",
    duration: "",
    hasRecording: false,
    labels: [
      { text: "Label", color: "orange" },
      { text: "Label", color: "purple" },
    ],
    time: "8:29 pm",
  },
  {
    id: "log2",
    name: "Kishor Talapade",
    phone: "+91 9876543210",
    direction: "outgoing",
    status: "connected",
    duration: "3:45",
    hasRecording: true,
    labels: [],
    agent: "Agent Name",
    time: "8:29 pm",
  },
  {
    id: "log3",
    name: "Kishor Talapade",
    phone: "+91 9876543210",
    direction: "incoming",
    status: "missed",
    duration: "3:45",
    hasRecording: true,
    labels: [
      { text: "Label", color: "orange" },
      { text: "Label", color: "purple" },
    ],
    note: "Occaecat cupidatat non pro, consectetur iscing elit. sed do eiusmod. iscing elit, sed do eiusmod Lorem ipsum dolor sit ame.",
    time: "8:29 pm",
  },
];

export const contactInfo: ContactInfo = {
  name: "~ pratik_jad",
  username: "pratik_jad",
  phone: "8912345678",
  initials: "P",
  firstName: "Pratik",
  lastName: "Jadhav",
  email: "email@mail.com",
  dob: "25/04/1993",
  gender: "Men",
  addresses: [
    "Beside COEP Boat Club, College of Engineering, Shivajinagar, Pune, Maharashtra 411005",
    "1186/A, Off J.M. Road, Shivaji nagar, Pune, Maharashtra 411005",
  ],
  notes: [
    {
      text: "Lorem ipsum dolor sit amet, consectetur iscing elit, sed.",
      author: "Kedar",
      date: "14 Sept 2022",
      time: "02:30 am",
    },
    {
      text: "Duis aute irure dolor in reprehenf edaa.",
      author: "Rajesh",
      date: "14 Sept 2022",
      time: "02:30 am",
    },
    {
      text: "Duis aute irure.",
      author: "Rajesh",
      date: "14 Sept 2022",
      time: "02:30 am",
    },
  ],
};

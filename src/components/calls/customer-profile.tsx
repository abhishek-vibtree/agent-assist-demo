"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import type { AgentAssistRow } from "@/lib/db-types";
import {
  X,
  Pencil,
  PlusCircle,
  ChevronRight,
  StickyNote,
  Package,
} from "lucide-react";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}

export function CustomerProfile({
  customer,
  onClose,
}: {
  customer: AgentAssistRow;
  onClose?: () => void;
}) {
  const details = customer.details || {};
  const initials =
    details.initials ||
    customer.customer_name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  const displayName = details.username
    ? `~ ${details.username}`
    : customer.customer_name;
  const notes = details.notes || [];
  const addresses = details.addresses || [];
  const orders = details.orders || [];

  return (
    <div className="flex h-full w-80 shrink-0 flex-col overflow-hidden border-l bg-muted/30">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Header */}
        <div className="relative flex items-center justify-center border-b bg-background px-4 py-8">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 rounded-md p-1 hover:bg-muted"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-5">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={`https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(customer.customer_name)}&backgroundColor=e0e0e0&textColor=555555`}
                alt={customer.customer_name}
              />
              <AvatarFallback className="bg-gray-300 text-2xl font-medium text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-2">
              <span className="text-base">{displayName}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-muted-foreground">
                  {customer.phone_number}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="border-b bg-background px-5 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Info</h3>
            <button className="rounded-md p-1 hover:bg-muted">
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <InfoRow label="First Name" value={details.firstName || ""} />
            <InfoRow label="Last Name" value={details.lastName || ""} />
            <InfoRow label="Email Address" value={customer.email || ""} />
            <InfoRow label="Date of Birth" value={details.dob || ""} />
            <InfoRow label="Gender" value={details.gender || ""} />
          </div>
        </div>

        {/* Order History */}
        <div className="border-b bg-background px-5 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Order History</h3>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium text-muted-foreground">
                {orders.length}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No orders yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map((order, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border p-2.5"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {order.image ? (
                      <img
                        src={order.image}
                        alt={order.product}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs font-medium text-foreground">
                      {order.product}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {order.orderNumber}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {order.date}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        {order.amount}
                      </span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                          order.status === "Delivered"
                            ? "bg-emerald-50 text-emerald-700"
                            : order.status === "Shipped" || order.status === "Processing"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="border-b bg-background px-5 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Notes</h3>
            <button className="rounded-md p-1 hover:bg-muted">
              <PlusCircle className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No notes yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {notes.map((note, i) => (
                <div key={i}>
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 shadow-sm">
                    <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {note.text}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground/70">
                    <span>{note.author}:</span>
                    <span>{note.date}</span>
                    <span>&#x2022;</span>
                    <span>{note.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {notes.length > 2 && (
            <button className="mt-3 text-sm font-medium text-emerald-600 hover:text-emerald-700">
              See all notes
            </button>
          )}
        </div>

        {/* Addresses */}
        <div className="bg-background px-5 py-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-medium">Addresses</h3>
            <button className="rounded-md p-1 hover:bg-muted">
              <PlusCircle className="h-5 w-5 text-emerald-600" />
            </button>
          </div>
          {addresses.length === 0 ? (
            <p className="text-xs text-muted-foreground">No addresses added</p>
          ) : (
            <div className="flex flex-col gap-4">
              {addresses.map((addr, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="mb-4" />}
                  <p className="mb-2 text-sm leading-relaxed text-foreground">
                    {addr}
                  </p>
                  <div className="flex gap-4">
                    <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                      Edit
                    </button>
                    <button className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

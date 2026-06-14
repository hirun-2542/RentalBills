"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TenantRow = {
  id: string;
  name: string;
  phone: string | null;
  lineUserId: string | null;
  active: boolean;
};

export type RoomRow = {
  id: string;
  number: string;
  description: string | null;
  rent: string;
  tenants: TenantRow[];
};

type RoomFormValues = {
  number: string;
  description: string;
  rent: string;
};

type TenantFormValues = {
  name: string;
  phone: string;
  lineUserId: string;
  active: boolean;
};

function getDisplayTenant(room: RoomRow) {
  return room.tenants.find((tenant) => tenant.active) ?? room.tenants[0] ?? null;
}

function sortRooms(rooms: RoomRow[]) {
  return [...rooms].sort((a, b) => a.number.localeCompare(b.number));
}

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error ?? "เกิดข้อผิดพลาด";
}

export function RoomManager({ initialRooms }: { initialRooms: RoomRow[] }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null);
  const [error, setError] = useState("");

  const roomForm = useForm<RoomFormValues>({
    defaultValues: { number: "", description: "", rent: "" },
  });

  const tenantForm = useForm<TenantFormValues>({
    defaultValues: { name: "", phone: "", lineUserId: "", active: true },
  });

  const editingTenant = useMemo(
    () => (editingRoom ? getDisplayTenant(editingRoom) : null),
    [editingRoom]
  );

  function openTenantDialog(room: RoomRow) {
    const tenant = getDisplayTenant(room);
    setError("");
    setEditingRoom(room);
    tenantForm.reset({
      name: tenant?.name ?? "",
      phone: tenant?.phone ?? "",
      lineUserId: tenant?.lineUserId ?? "",
      active: tenant?.active ?? true,
    });
  }

  async function createRoom(values: RoomFormValues) {
    setError("");
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: values.number,
        description: values.description,
        rent: Number(values.rent),
      }),
    });

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    const room = (await response.json()) as Omit<RoomRow, "tenants">;
    setRooms((current) => sortRooms([...current, { ...room, tenants: [] }]));
    roomForm.reset();
    setAddOpen(false);
  }

  async function saveTenant(values: TenantFormValues) {
    if (!editingRoom) {
      return;
    }

    setError("");
    const body = {
      name: values.name,
      phone: values.phone,
      lineUserId: values.lineUserId,
      active: values.active,
    };
    const response = await fetch(
      editingTenant ? `/api/tenants/${editingTenant.id}` : "/api/tenants",
      {
        method: editingTenant ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingTenant ? body : { ...body, roomId: editingRoom.id }
        ),
      }
    );

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    const tenant = (await response.json()) as TenantRow;
    setRooms((current) =>
      current.map((room) => {
        if (room.id !== editingRoom.id) {
          return room;
        }

        const tenants = editingTenant
          ? room.tenants.map((item) => (item.id === tenant.id ? tenant : item))
          : [tenant, ...room.tenants];

        return { ...room, tenants };
      })
    );
    setEditingRoom(null);
  }

  async function deleteRoom(room: RoomRow) {
    if (!window.confirm(`ลบห้อง ${room.number}?`)) {
      return;
    }

    setError("");
    const response = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });

    if (!response.ok) {
      setError(await readApiError(response));
      return;
    }

    setRooms((current) => current.filter((item) => item.id !== room.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Rooms</h1>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>เพิ่มห้อง</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มห้อง</DialogTitle>
            </DialogHeader>
            <Form {...roomForm}>
              <form
                className="space-y-4"
                onSubmit={roomForm.handleSubmit(createRoom)}
              >
                <FormField
                  control={roomForm.control}
                  name="number"
                  rules={{ required: "กรุณากรอกเลขห้อง" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ห้อง</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={roomForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>รายละเอียด</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={roomForm.control}
                  name="rent"
                  rules={{ required: "กรุณากรอกค่าเช่า" }}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ค่าเช่า</FormLabel>
                      <FormControl>
                        <Input min="0" step="0.01" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={roomForm.formState.isSubmitting}>
                  บันทึก
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ห้อง</TableHead>
            <TableHead>ผู้เช่า</TableHead>
            <TableHead>LINE User ID</TableHead>
            <TableHead>เบอร์โทร</TableHead>
            <TableHead>ค่าเช่า</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rooms.map((room) => {
            const tenant = getDisplayTenant(room);

            return (
              <TableRow key={room.id}>
                <TableCell className="font-medium">{room.number}</TableCell>
                <TableCell>{tenant?.name ?? "-"}</TableCell>
                <TableCell>{tenant?.lineUserId ?? "-"}</TableCell>
                <TableCell>{tenant?.phone ?? "-"}</TableCell>
                <TableCell>{Number(room.rent).toLocaleString("th-TH")}</TableCell>
                <TableCell>
                  {tenant ? (tenant.active ? "ใช้งาน" : "ปิดใช้งาน") : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTenantDialog(room)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteRoom(room)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog
        open={!!editingRoom}
        onOpenChange={(open) => {
          if (!open) {
            setEditingRoom(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขผู้เช่า</DialogTitle>
          </DialogHeader>
          <Form {...tenantForm}>
            <form
              className="space-y-4"
              onSubmit={tenantForm.handleSubmit(saveTenant)}
            >
              <FormField
                control={tenantForm.control}
                name="name"
                rules={{ required: "กรุณากรอกชื่อผู้เช่า" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ผู้เช่า</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={tenantForm.control}
                name="lineUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LINE User ID</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={tenantForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>เบอร์โทร</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {editingTenant ? (
                <FormField
                  control={tenantForm.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input
                          checked={field.value}
                          className="h-4 w-4"
                          type="checkbox"
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel>ใช้งาน</FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
              <Button
                type="submit"
                disabled={tenantForm.formState.isSubmitting}
              >
                บันทึก
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

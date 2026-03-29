import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const DVLA_URL = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.DVLA_API_KEY) {
    return NextResponse.json({ error: "DVLA_API_KEY not configured" }, { status: 500 });
  }

  const { reg } = await req.json() as { reg?: string };
  if (!reg) return NextResponse.json({ error: "reg required" }, { status: 400 });

  const plate = reg.replace(/\s/g, "").toUpperCase();

  const res = await fetch(DVLA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.DVLA_API_KEY,
    },
    body: JSON.stringify({ registrationNumber: plate }),
  });

  if (res.status === 404) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `DVLA error: ${res.status}` }, { status: 502 });
  }

  const data = await res.json() as {
    make?: string;
    colour?: string;
    yearOfManufacture?: number;
    engineCapacity?: number;
    fuelType?: string;
  };

  const make = data.make
    ? data.make.charAt(0).toUpperCase() + data.make.slice(1).toLowerCase()
    : "";

  return NextResponse.json({
    make,
    colour: data.colour
      ? data.colour.charAt(0).toUpperCase() + data.colour.slice(1).toLowerCase()
      : "",
    year: data.yearOfManufacture ?? null,
    fuelType: data.fuelType ?? null,
    engineCapacity: data.engineCapacity ?? null,
  });
}

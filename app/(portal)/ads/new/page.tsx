"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PhotoManager from "../_components/PhotoManager";
import PlatformSelector from "../_components/PlatformSelector";
import ShowroomPanel from "../_components/ShowroomPanel";

type Car = {
  id: number;
  reg: string;
  car_name: string | null;
  status: string;
};

const STEPS = ["Select Car", "Photos", "Showroom", "Ad Details", "Publish"];

export default function NewAdPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledCarId = searchParams.get("inventory_id")
    ? parseInt(searchParams.get("inventory_id")!)
    : null;

  const [step, setStep] = useState(prefilledCarId ? 1 : 0);
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<number[]>([]);

  // Step 1 — photos list (for showroom)
  const [photosList, setPhotosList] = useState<{ id: number; file_path: string; processed_path: string | null; label: string | null }[]>([]);

  async function loadPhotos(carId: number) {
    const res = await fetch(`/api/car-photos?inventory_id=${carId}`);
    const data = await res.json();
    setPhotosList(data);
  }

  // Step 3 — ad details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Step 3 — platforms
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function loadCars() {
    const res = await fetch("/api/inventory");
    const data = await res.json() as { cars?: Car[] } | Car[];
    const carList = Array.isArray(data) ? data : (data as { cars: Car[] }).cars ?? [];
    setCars(carList);
    if (prefilledCarId) {
      const car = carList.find((c) => c.id === prefilledCarId);
      if (car) {
        setSelectedCar(car);
        setTitle(car.car_name ?? car.reg);
      }
    }
  }

  useEffect(() => {
    loadCars();
  }, []);

  function selectCar(car: Car) {
    setSelectedCar(car);
    setTitle(car.car_name ?? car.reg);
    setStep(1);
  }

  async function generateDescription() {
    if (!selectedCar) return;
    setGeneratingDesc(true);
    try {
      const res = await fetch("/api/listings/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory_id: selectedCar.id }),
      });
      const { description: generated } = await res.json() as { description?: string };
      if (generated) setDescription(generated);
    } catch {
      // ignore
    } finally {
      setGeneratingDesc(false);
    }
  }

  async function handleSubmit() {
    if (!selectedCar || !title || !description || !price) return;
    setSubmitting(true);
    try {
      // Create listing
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventory_id: selectedCar.id,
          title,
          description,
          price: parseFloat(price),
          selected_photo_ids: selectedPhotoIds,
        }),
      });
      const listing = await res.json() as { id: number };

      // Publish to selected platforms
      if (selectedPlatforms.length > 0) {
        await fetch(`/api/listings/${listing.id}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platforms: selectedPlatforms }),
        });
      }

      router.push(`/ads/${listing.id}`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/ads" className="text-sm text-blue-600 hover:underline">← Ads</Link>
        <h2 className="text-2xl font-bold mt-1">Create New Ad</h2>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < step ? "bg-green-500 text-white" : i === step ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {i < step ? "✓" : i + 1}
            </div>
            <span className={`text-sm hidden sm:inline ${i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-gray-300 hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* Step 0: Select car */}
      {step === 0 && (
        <div className="bg-white rounded-lg border p-5">
          <h3 className="font-semibold mb-4">Select a Car</h3>
          {cars.length === 0 ? (
            <p className="text-sm text-gray-400">No cars in inventory.</p>
          ) : (
            <div className="divide-y">
              {cars.map((car) => (
                <button
                  key={car.id}
                  onClick={() => selectCar(car)}
                  className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 px-2 -mx-2 rounded transition-colors"
                >
                  <div>
                    <span className="font-mono font-semibold text-sm">{car.reg}</span>
                    {car.car_name && <span className="text-sm text-gray-600 ml-2">— {car.car_name}</span>}
                  </div>
                  <span className="text-xs text-gray-400">{car.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 1: Photos */}
      {step === 1 && selectedCar && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Photos</h3>
                <p className="text-xs text-gray-400 mt-0.5">Upload and select photos for this ad. Click a photo to select/deselect it.</p>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {selectedPhotoIds.length} selected
              </span>
            </div>
            <PhotoManager
              inventoryId={selectedCar.id}
              selectedIds={selectedPhotoIds}
              onSelectionChange={setSelectedPhotoIds}
            />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(0)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Back</button>
            <button onClick={() => { loadPhotos(selectedCar.id); setStep(2); }} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              Next: Showroom
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Showroom */}
      {step === 2 && selectedCar && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold mb-1">Showroom</h3>
            <p className="text-xs text-gray-400 mb-4">Apply AI-generated backgrounds to your car photos. Click Use to add a generated photo to your ad.</p>
            <ShowroomPanel
              photos={selectedPhotoIds.length > 0 ? photosList.filter(p => selectedPhotoIds.includes(p.id)) : photosList}
              inventoryId={selectedCar.id}
              onAddShowroomPhoto={(filePath, label) => {
                // Upload the showroom photo as a car_photo so it can be selected
                fetch("/api/car-photos", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ inventory_id: selectedCar.id, file_path: filePath, label }),
                }).then(() => loadPhotos(selectedCar.id));
              }}
            />
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Back</button>
            <button onClick={() => setStep(3)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
              Next: Ad Details
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Ad details */}
      {step === 3 && selectedCar && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-5 space-y-4">
            <h3 className="font-semibold">Ad Details</h3>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. 2021 Ford Focus — Excellent Condition"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-500">Description *</label>
                <button
                  type="button"
                  onClick={generateDescription}
                  disabled={generatingDesc}
                  className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1"
                >
                  {generatingDesc ? (
                    <>
                      <span className="animate-spin inline-block w-3 h-3 border border-purple-500 border-t-transparent rounded-full" />
                      Generating…
                    </>
                  ) : "✨ Generate with AI"}
                </button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Write a compelling description for this car…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Asking Price (£) *</label>
              <input
                type="number"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="9500"
              />
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Back</button>
            <button
              onClick={() => setStep(4)}
              disabled={!title || !description || !price}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Next: Platforms
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Platforms + review */}
      {step === 4 && selectedCar && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-5 space-y-4">
            <h3 className="font-semibold">Review & Publish</h3>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Car</span>
                <span className="font-medium">{selectedCar.reg}{selectedCar.car_name ? ` — ${selectedCar.car_name}` : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Title</span>
                <span className="font-medium">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Price</span>
                <span className="font-medium">£{parseFloat(price).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Photos selected</span>
                <span className="font-medium">{selectedPhotoIds.length}</span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Publish to platforms</p>
              <PlatformSelector
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
              <p className="text-xs text-gray-400 mt-2">Leave unchecked to save as a draft.</p>
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">Back</button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Saving…" : selectedPlatforms.length > 0 ? "Publish Ad" : "Save as Draft"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

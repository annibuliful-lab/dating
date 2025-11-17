"use client";

import { ProfileImage } from "@/@types/user";
import { supabase } from "@/client/supabase";
import { TOP_NAVBAR_HEIGHT_PX } from "@/components/element/TopNavbar";
import { CalendarIcon } from "@/components/icons/CalendarIcon";
import { CameraIcon } from "@/components/icons/CameraIcon";
import { getUserProfile } from "@/services/profile/get";
import { saveProfileImages } from "@/services/profile/images";
import { updateUserProfile } from "@/services/profile/update";
import {
  Box,
  Button,
  Container,
  Group,
  Image,
  LoadingOverlay,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  rem,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function EditProfilePage() {
  const { data } = useSession();
  const router = useRouter();

  // Public profile states
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [birthday, setBirthday] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const BIO_LIMIT = 150;

  // Private details states
  const [phone, setPhone] = useState("");
  const [lineId, setLineId] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarKey, setAvatarKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Profile images states
  const [profileImages, setProfileImages] = useState<
    Array<ProfileImage & { tempId?: string }>
  >([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const profileImagesInputRef = useRef<HTMLInputElement | null>(null);

  const userId = data?.user?.id;
  const BUCKET = "dating";

  const openFilePicker = () => fileInputRef.current?.click();
  const openProfileImagesPicker = () =>
    profileImagesInputRef.current?.click();

  useEffect(() => {
    if (!userId) {
      return;
    }

    (async () => {
      try {
        const profile = await getUserProfile(userId);
        console.log("profile", profile);
        setUsername(profile.username ?? "");
        // If you only have fullName in the DB, split it loosely for display
        // const fullName = (profile.fullName as string | null) ?? '';
        // if (fullName && !name && !lastname) {
        //   const [first, ...rest] = fullName.split(' ');
        //   setName(first ?? '');
        //   setLastname(rest.join(' ') ?? '');
        // }

        setName(profile.fullName ?? "");
        setLastname(profile.lastname);

        setGender(profile.gender ?? null);
        setBirthday(profile.birthday ? profile.birthday : null);
        setStatus(profile.relationShipStatus ?? null);
        setBio(profile.bio ?? "");
        setPhone(profile.phone ?? "");
        setLineId(profile.lineId ?? "");
        setHeight(profile.height != null ? String(profile.height) : "");
        setWeight(profile.weight != null ? String(profile.weight) : "");
        setAvatarUrl(profile.avatarUrl ?? null);
        setProfileImages(profile.profileImages || []);
      } catch (err) {
        console.error(err);
        notifications.show({
          color: "red",
          title: "Load failed",
          message: (err as Error).message ?? "Could not load your profile.",
        });
      }
    })();
  }, [userId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // basic validation
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      alert("Only PNG, JPG, or WEBP allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Max 5MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const key = `users/${
        userId || "anon"
      }/avatar-${userId}-${new Date().toISOString()}.${ext}`;

      // upload (upsert true lets you replace on re-upload)
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(key, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: "3600",
        });

      if (uploadErr) throw uploadErr;

      // get a public URL (or use createSignedUrl if your bucket is private)
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);

      setAvatarUrl(pub.publicUrl);
      setAvatarKey(key);
    } catch (err) {
      console.error(err);
      alert((err as Error).message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleProfileImagesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (profileImages.length + files.length > 5) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "Maximum 5 images allowed",
      });
      return;
    }

    // Validate files
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    const invalidFiles = files.filter(
      (file) => !validTypes.includes(file.type) || file.size > 5 * 1024 * 1024
    );

    if (invalidFiles.length > 0) {
      notifications.show({
        color: "red",
        title: "Error",
        message: "Only PNG, JPG, or WEBP allowed. Max 5MB per file.",
      });
      return;
    }

    setUploadingImages(true);
    try {
      const newImages: Array<ProfileImage & { tempId?: string }> = [];

      for (const file of files) {
        const ext = file.name.split(".").pop() || "jpg";
        const key = `users/${userId || "anon"}/profile-images/${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;

        // Upload file
        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(key, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: "3600",
          });

        if (uploadErr) throw uploadErr;

        // Get public URL
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);

        newImages.push({
          id: `temp-${Date.now()}-${Math.random()}`,
          imageKey: key,
          imageUrl: pub.publicUrl,
          order: profileImages.length + newImages.length,
          tempId: `temp-${Date.now()}-${Math.random()}`,
        });
      }

      setProfileImages([...profileImages, ...newImages]);
    } catch (err) {
      console.error(err);
      notifications.show({
        color: "red",
        title: "Upload failed",
        message: (err as Error).message ?? "Could not upload images",
      });
    } finally {
      setUploadingImages(false);
      if (profileImagesInputRef.current)
        profileImagesInputRef.current.value = "";
    }
  };

  const handleDeleteProfileImage = (index: number) => {
    const image = profileImages[index];
    setProfileImages(profileImages.filter((_, i) => i !== index));

    // If it's a temporary image (not saved yet), delete from storage
    if (image.tempId && userId) {
      supabase.storage
        .from(BUCKET)
        .remove([image.imageKey])
        .catch((err) => console.error("Error deleting temp image:", err));
    }
  };

  const handleSaveClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    if (!data?.user.id) return;

    // Validate required fields
    if (
      !username.trim() ||
      !name.trim() ||
      !lastname.trim() ||
      !gender ||
      !birthday ||
      !status
    ) {
      setShowConfirmModal(false);
      notifications.show({
        color: "red",
        title: "Error",
        message: "Please complete all data",
      });
      return;
    }

    setShowConfirmModal(false);
    setSaving(true);

    try {
      const profileData = {
        username,
        name,
        lastname,
        gender,
        birthday,
        relationShipStatus: status,
        bio,
        phone,
        lineId,
        height,
        weight,
      };

      await updateUserProfile(data.user.id, {
        ...profileData,
        profileImageKey: avatarKey,
      } as never);

      // Save profile images
      if (profileImages.length > 0) {
        await saveProfileImages(
          data.user.id,
          profileImages.map((img, index) => ({
            id: img.id,
            imageKey: img.imageKey,
            order: index,
          }))
        );
      }

      notifications.show({
        color: "green",
        title: "Success",
        message: "Profile saved successfully",
      });
    } catch (err) {
      console.error("Error saving profile:", err);
      notifications.show({
        color: "red",
        title: "Error",
        message: "Please complete all data",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        pos="fixed"
        top={0}
        left={0}
        right={0}
        bg="#0F0F0F"
        style={{
          borderBottom: "1px solid var(--mantine-color-dark-4)",
          height: `calc(${rem(
            TOP_NAVBAR_HEIGHT_PX
          )} + env(safe-area-inset-top))`,
          paddingTop: "env(safe-area-inset-top)",
          zIndex: 100,
        }}
      >
        <Group h={rem(TOP_NAVBAR_HEIGHT_PX)} px="md" justify="space-between">
          <Text c="white" onClick={() => router.back()}>
            ← Back
          </Text>
          <Text c="white" fw={600}>
            Edit Profile
          </Text>
          <Text
            c="gold.5"
            fw={600}
            onClick={handleSaveClick}
            style={{ cursor: "pointer" }}
          >
            Save
          </Text>
        </Group>
      </Box>

      <Container size="xs" pt="md" px="md" mt={rem(TOP_NAVBAR_HEIGHT_PX)}>
        <Stack gap="lg" pb="xl">
          <Box style={{ display: "grid", placeItems: "center" }}>
            <Box
              style={{
                position: "relative",
                width: rem(150),
                height: rem(150),
              }}
            >
              <LoadingOverlay
                visible={uploading}
                zIndex={2}
                overlayProps={{ radius: "lg", blur: 2 }}
              />
              <Box
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "1px solid var(--mantine-color-dark-4)",
                  background: avatarUrl
                    ? `center/cover no-repeat url(${avatarUrl})`
                    : "repeating-conic-gradient(#333 0% 25%, transparent 0% 50%) 50% / 20px 20px",
                  opacity: avatarUrl ? 1 : 0.8,
                  cursor: "pointer",
                }}
                onClick={openFilePicker}
                title="Change avatar"
              />

              <ThemeIcon
                radius="xl"
                size={34}
                style={{
                  position: "absolute",
                  right: rem(4),
                  bottom: rem(4),
                  backgroundColor: "white",
                  border: "1px solid var(--mantine-color-dark-4)",
                  boxShadow: "0 8px 20px rgba(0, 0, 0, 0.35)",
                  zIndex: 3,
                  cursor: "pointer",
                }}
                variant="light"
                color="dark.4"
                onClick={openFilePicker}
                title="Upload"
              >
                <CameraIcon />
              </ThemeIcon>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </Box>
          </Box>

          <Stack gap="sm">
            <Text fw={700}>Public profile</Text>
            <TextInput
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
            />
            <TextInput
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
            />
            <TextInput
              placeholder="Lastname"
              value={lastname}
              onChange={(e) => setLastname(e.currentTarget.value)}
            />

            <Select
              placeholder="Gender"
              data={["Male", "Female", "Other"]}
              value={gender}
              onChange={setGender}
              rightSection={<Text>›</Text>}
              comboboxProps={{ withinPortal: true }}
            />

            <DateInput
              placeholder="Birthday"
              valueFormat="MMM DD, YYYY"
              variant="filled"
              value={birthday}
              onChange={setBirthday}
              rightSection={<CalendarIcon />}
            />

            <Select
              placeholder="Status"
              data={["Single", "In a relationship", "Married"]}
              value={status}
              onChange={setStatus}
              rightSection={<Text>›</Text>}
              comboboxProps={{ withinPortal: true }}
            />

            <Box>
              <Textarea
                placeholder="Bio"
                autosize
                minRows={5}
                maxRows={6}
                value={bio}
                onChange={(e) =>
                  setBio(e.currentTarget.value.slice(0, BIO_LIMIT))
                }
              />
              <Text fz="xs" c="dimmed" ta="right">
                {bio.length}/{BIO_LIMIT}
              </Text>
            </Box>
          </Stack>

          {/* Private details section */}
          <Stack gap="sm">
            <Text fw={700}>Private details</Text>
            <TextInput
              placeholder="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
            />
            <TextInput
              placeholder="Line ID"
              value={lineId}
              onChange={(e) => setLineId(e.currentTarget.value)}
            />
            <TextInput
              placeholder="Height"
              rightSection={<Text c="dimmed">cm</Text>}
              value={height}
              onChange={(e) => setHeight(e.currentTarget.value)}
            />
            <TextInput
              placeholder="Weight"
              rightSection={<Text c="dimmed">kg</Text>}
              value={weight}
              onChange={(e) => setWeight(e.currentTarget.value)}
            />
          </Stack>

          {/* Image upload section */}
          <Stack gap="sm">
            <Text fw={700} c="red">
              เพิ่มรูปภาพ สูงสุด 5 ภาพ
            </Text>
            <SimpleGrid cols={3} spacing="sm">
              {profileImages.map((img, index) => (
                <Box
                  key={img.id || img.tempId}
                  style={{
                    position: "relative",
                    aspectRatio: "1",
                    borderRadius: rem(8),
                    overflow: "hidden",
                    border: "1px solid var(--mantine-color-dark-4)",
                  }}
                >
                  <Image
                    src={img.imageUrl}
                    alt={`Profile image ${index + 1}`}
                    fit="cover"
                    w="100%"
                    h="100%"
                  />
                  <Box
                    style={{
                      position: "absolute",
                      top: rem(4),
                      right: rem(4),
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      borderRadius: "50%",
                      width: rem(24),
                      height: rem(24),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => handleDeleteProfileImage(index)}
                  >
                    <Text c="white" fz="xs" fw={700}>
                      ×
                    </Text>
                  </Box>
                </Box>
              ))}
              {profileImages.length < 5 && (
                <Box
                  style={{
                    aspectRatio: "1",
                    borderRadius: rem(8),
                    border: "2px dashed var(--mantine-color-red-6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    backgroundColor: "var(--mantine-color-dark-7)",
                  }}
                  onClick={openProfileImagesPicker}
                >
                  <Text c="red" fz="xl" fw={700}>
                    +
                  </Text>
                </Box>
              )}
            </SimpleGrid>
            <input
              ref={profileImagesInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleProfileImagesChange}
              style={{ display: "none" }}
            />
            {uploadingImages && (
              <Text c="dimmed" fz="xs" ta="center">
                Uploading images...
              </Text>
            )}
          </Stack>
        </Stack>
      </Container>

      {/* Confirmation Modal */}
      <Modal
        opened={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Save"
        centered
      >
        <Stack gap="md">
          <Text>Are you sure you want to save these changes?</Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => setShowConfirmModal(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmSave} loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

export default EditProfilePage;

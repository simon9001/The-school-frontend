import React, { useState, useRef, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  User,
  Mail,
  Phone,
  Shield,
  KeyRound,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  Lock,
  BadgeCheck,
  X,
} from 'lucide-react'
import DashboardLayout from '../../dashboardDesign/DashboardLayout'
import type { RootState, AppDispatch } from '../../store/store'
import {
  useMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from '../auth/AuthApi'
import { updateUserProfile } from '../auth/AuthSlice'

export const ProfilePage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { user: currentUser } = useSelector((state: RootState) => state.authSlice)

  // Fetch freshest profile from API
  const { data: profile, isLoading: isProfileLoading, refetch } = useMeQuery()
  const [updateProfile, { isLoading: isUpdatingProfile }] = useUpdateProfileMutation()
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation()

  // Form states
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // Password state & visibility toggle
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI Feedback
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const u = profile || currentUser
    if (u) {
      setFullName(u.fullName || '')
      setPhone(u.phone || '')
      setAvatarPreview(u.avatarUrl || null)
    }
  }, [profile, currentUser])

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setProfileError('Passport photo must be under 2MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setAvatarPreview(result)
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setAvatarPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSuccess(null)
    setProfileError(null)

    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty')
      return
    }

    try {
      const updated = await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: avatarPreview,
      }).unwrap()

      dispatch(updateUserProfile(updated))
      setProfileSuccess('Profile and passport photo updated successfully!')
      refetch()
    } catch (err: any) {
      setProfileError(err?.data?.error || err?.message || 'Failed to update profile')
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordSuccess(null)
    setPasswordError(null)

    if (!currentPassword) {
      setPasswordError('Please enter your current password')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    try {
      const res = await changePassword({
        currentPassword,
        newPassword,
      }).unwrap()

      setPasswordSuccess(res.message || 'Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (err: any) {
      setPasswordError(err?.data?.error || err?.message || 'Failed to change password')
    }
  }

  const activeUser = profile || currentUser
  const initials = activeUser?.fullName
    ? activeUser.fullName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-12">
        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-green-800 via-emerald-700 to-teal-800 relative" />

          <div className="px-6 sm:px-8 pb-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end gap-6 -mt-16 sm:-mt-12">
            {/* Passport Photo Frame */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white p-1.5 shadow-xl border-2 border-white ring-4 ring-green-100 overflow-hidden flex items-center justify-center bg-gray-50">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Passport Photo"
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-full h-full bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center text-3xl font-bold">
                    {initials}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-1 right-1 bg-green-800 hover:bg-green-900 text-white p-2 rounded-xl shadow-lg transition-transform transform active:scale-95 flex items-center justify-center cursor-pointer"
                title="Upload Passport Photo"
              >
                <Camera size={16} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>

            {/* User Title & Info */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                    {activeUser?.fullName || 'User Profile'}
                    <BadgeCheck className="text-green-600" size={22} />
                  </h1>
                  <p className="text-sm text-gray-500">{activeUser?.email}</p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center sm:justify-end mt-2 sm:mt-0">
                  {activeUser?.roles?.map((role) => (
                    <span
                      key={role}
                      className="px-3 py-1 bg-green-100 text-green-900 text-xs font-semibold rounded-full uppercase tracking-wider"
                    >
                      {role.replace(/_/g, ' ')}
                    </span>
                  ))}
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full">
                    Active Account
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Personal Information & Passport Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Details Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <User className="text-green-800" size={20} />
                  <h2 className="text-lg font-bold text-gray-800">Personal Information</h2>
                </div>
                {avatarPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 size={14} /> Remove Photo
                  </button>
                )}
              </div>

              {profileSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-sm">
                  <CheckCircle2 size={18} className="shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {profileError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-3 text-sm">
                  <AlertCircle size={18} className="shrink-0" />
                  <span>{profileError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="input input-bordered w-full pl-9 text-sm focus:border-green-800"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="email"
                        value={activeUser?.email || ''}
                        disabled
                        className="input input-bordered w-full pl-9 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input input-bordered w-full pl-9 text-sm focus:border-green-800"
                        placeholder="+254 700 000000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Passport Photo Status
                    </label>
                    <div className="flex items-center h-10 px-3 border border-gray-200 rounded-lg bg-gray-50 text-xs text-gray-600 justify-between">
                      <span>{avatarPreview ? 'Photo attached' : 'No photo uploaded'}</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-green-800 hover:underline font-semibold"
                      >
                        {avatarPreview ? 'Change' : 'Upload'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdatingProfile || isProfileLoading}
                    className="btn bg-green-800 hover:bg-green-900 text-white shadow-sm btn-sm px-6"
                  >
                    {isUpdatingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Account Stats & Password Security */}
          <div className="space-y-6">
            {/* Account Details Box */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                Account Overview
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Shield size={16} /> User ID
                  </span>
                  <span className="font-semibold text-gray-800">#{activeUser?.id}</span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Calendar size={16} /> Member Since
                  </span>
                  <span className="font-semibold text-gray-800">
                    {activeUser?.createdAt
                      ? new Date(activeUser.createdAt).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Clock size={16} /> Last Login
                  </span>
                  <span className="font-semibold text-gray-800 text-xs">
                    {activeUser?.lastLoginAt
                      ? new Date(activeUser.lastLoginAt).toLocaleString()
                      : 'Current Session'}
                  </span>
                </div>
              </div>
            </div>

            {/* Password Management Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="text-green-800" size={20} />
                  <h2 className="text-lg font-bold text-gray-800">Security & Password</h2>
                </div>
                {showPasswordForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setPasswordError(null)
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Cancel"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>

              {passwordSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 text-xs">
                  <CheckCircle2 size={16} className="shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-xs">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {!showPasswordForm ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">
                    Ensure your account stays secure by periodically updating your password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(true)
                      setPasswordSuccess(null)
                      setPasswordError(null)
                    }}
                    className="btn bg-gray-900 hover:bg-black text-white w-full btn-sm shadow-xs flex items-center justify-center gap-2"
                  >
                    <KeyRound size={15} /> Reset / Change Password
                  </button>
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input input-bordered w-full pl-9 text-sm focus:border-green-800"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input input-bordered w-full pl-9 text-sm focus:border-green-800"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-3 top-3 text-gray-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input input-bordered w-full pl-9 text-sm focus:border-green-800"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(false)}
                      className="btn btn-ghost btn-sm flex-1 text-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="btn bg-gray-900 hover:bg-black text-white btn-sm flex-1 shadow-xs"
                    >
                      {isChangingPassword ? 'Updating...' : 'Save Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default ProfilePage

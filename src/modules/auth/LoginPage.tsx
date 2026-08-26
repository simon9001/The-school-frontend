import React from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router'
import { GraduationCap, LogIn } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { AuthApi } from './AuthApi'
import { setCredentials } from './AuthSlice'
import type { AppDispatch } from '../../store/store'
import type { LoginFormValues } from './types'

const Login: React.FC = () => {
    const { register, handleSubmit, formState: { errors } } = useForm<LoginFormValues>()
    const [login, { isLoading }] = AuthApi.useLoginMutation()
    const dispatch = useDispatch<AppDispatch>()
    const navigate = useNavigate()

    const onSubmit: SubmitHandler<LoginFormValues> = async (data) => {
        const loadingToastId = toast.loading('Signing in...')
        try {
            const result = await login(data).unwrap()
            dispatch(setCredentials(result))
            toast.success(`Welcome back, ${result.user.fullName}`, { id: loadingToastId })
            navigate('/dashboard')
        } catch {
            toast.error('Invalid email or password', { id: loadingToastId })
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <Toaster position="top-right" richColors />
            <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
                <div className="flex flex-col items-center mb-6">
                    <GraduationCap size={40} className="text-green-800 mb-2" />
                    <h1 className="text-xl font-bold text-gray-800">Sign in to your account</h1>
                    <p className="text-sm text-gray-500">School Management System</p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="input input-bordered w-full"
                            {...register('email', { required: 'Email is required' })}
                        />
                        {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                    </div>

                    <div className="mb-6">
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="input input-bordered w-full"
                            {...register('password', { required: 'Password is required' })}
                        />
                        {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
                    </div>

                    <button type="submit" disabled={isLoading} className="btn bg-green-800 hover:bg-green-900 text-white w-full flex items-center justify-center gap-2">
                        <LogIn size={16} />
                        {isLoading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default Login

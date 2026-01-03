/**
 * Admin API 테스트
 */

import { adminAPI } from '../admin'
import { apiRequest } from '../client'

// apiRequest 모킹
jest.mock('../client')

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>

describe('adminAPI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should list users successfully', async () => {
    const mockUsers = [
      { id: 1, username: 'user1', role: 'user' },
      { id: 2, username: 'admin', role: 'admin' },
    ]

    mockApiRequest.mockResolvedValue(mockUsers)

    const result = await adminAPI.listUsers()

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/users')
    expect(result).toEqual(mockUsers)
  })

  it('should get user details successfully', async () => {
    const userId = 1
    const mockUser = {
      id: userId,
      username: 'user1',
      role: 'user',
      vms: [],
    }

    mockApiRequest.mockResolvedValue(mockUser)

    const result = await adminAPI.getUser(userId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}`)
    expect(result).toEqual(mockUser)
  })

  it('should create user successfully', async () => {
    const createData = {
      username: 'newuser',
      password: 'password',
      role: 'user',
    }

    const createdUser = {
      id: 1,
      ...createData,
    }

    mockApiRequest.mockResolvedValue(createdUser)

    const result = await adminAPI.createUser(createData)

    expect(mockApiRequest).toHaveBeenCalledWith('/admin/users', {
      method: 'POST',
      body: JSON.stringify(createData),
    })
    expect(result).toEqual(createdUser)
  })

  it('should update user successfully', async () => {
    const userId = 1
    const updateData = {
      role: 'admin',
    }

    const updatedUser = {
      id: userId,
      username: 'user1',
      ...updateData,
    }

    mockApiRequest.mockResolvedValue(updatedUser)

    const result = await adminAPI.updateUser(userId, updateData)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
    expect(result).toEqual(updatedUser)
  })

  it('should delete user successfully', async () => {
    const userId = 1

    mockApiRequest.mockResolvedValue(undefined)

    await adminAPI.deleteUser(userId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}`, {
      method: 'DELETE',
    })
  })

  it('should update user role successfully', async () => {
    const userId = 1
    const role = 'admin'

    const updatedUser = {
      id: userId,
      username: 'user1',
      role,
    }

    mockApiRequest.mockResolvedValue(updatedUser)

    const result = await adminAPI.updateUserRole(userId, role)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    })
    expect(result).toEqual(updatedUser)
  })

  it('should approve user successfully', async () => {
    const userId = 1

    const approvedUser = {
      id: userId,
      username: 'user1',
      role: 'user',
      approved: true,
    }

    mockApiRequest.mockResolvedValue(approvedUser)

    const result = await adminAPI.approveUser(userId)

    expect(mockApiRequest).toHaveBeenCalledWith(`/admin/users/${userId}/approve`, {
      method: 'PUT',
    })
    expect(result).toEqual(approvedUser)
  })
})


import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../services/api';
import { useAppSelector } from '../../app/hooks';

interface ApprovalRequest {
  id: string;
  request_type: string;
  status: string;
  requester_id: string;
  branch_id: string;
  original_doc_entry: number;
  original_doc_num: string;
  amount: number;
  reason: string;
  created_at: string;
}

const Approvals = () => {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useAppSelector((state) => state.auth.user);

  const fetchApprovals = async () => {
    try {
      const response = await api.get('/admin/approvals');
      setRequests(response.data);
    } catch {
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;
    
    try {
      await api.post(`/admin/approvals/${id}/${action}`);
      toast.success(`Request ${action}d successfully`);
      fetchApprovals();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || `Failed to ${action} request`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-sm text-gray-500">Review and manage return and exchange requests.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Invoice #</th>
                <th className="px-6 py-4 font-semibold">Branch</th>
                <th className="px-6 py-4 font-semibold">Amount</th>
                <th className="px-6 py-4 font-semibold">Reason</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No pending approvals.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const isSelf = req.requester_id === currentUser?.id || req.requester_id === currentUser?.username;
                  return (
                    <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-gray-600">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {req.request_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                          req.status === 'failed' ? 'bg-red-100 text-red-800' :
                          req.status === 'outcome-unknown' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {req.original_doc_num}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {req.branch_id}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">
                        ₹{req.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {req.status === 'pending' ? (
                          isSelf ? (
                            <span className="text-xs text-amber-600 font-medium">Cannot self-approve</span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleAction(req.id, 'reject')}
                                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleAction(req.id, 'approve')}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
                              >
                                Approve
                              </button>
                            </>
                          )
                        ) : (
                          <span className="text-xs text-gray-500 font-medium text-left inline-block w-full max-w-[150px]">
                            {req.status === 'failed' ? 'SAP Error. Verify in SAP, then create manually if needed.' : 'Connection lost during SAP write. Verify in SAP manually.'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Approvals;

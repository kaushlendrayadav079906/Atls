import React from 'react';
import { BookOpen, Database, Shield, Layout, ArrowRight } from 'lucide-react';

const Project: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in">
      <div className="flex items-center space-x-3 mb-8">
        <BookOpen className="w-8 h-8 text-indigo-600" />
        <h1 className="text-3xl font-bold text-gray-900">Project Architecture & Status</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Purpose */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <Layout className="w-5 h-5 mr-2 text-indigo-500" />
            Purpose & Scope
          </h2>
          <p className="text-gray-600 leading-relaxed">
            POS-Inventory Kool is a comprehensive Point of Sale (POS) and inventory management system 
            designed to connect directly with SAP Business One. The system provides real-time operational 
            workflows for cashiers (Operators) and reporting/management tools for Administrators and Managers.
          </p>
        </div>

        {/* Security & Roles */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-indigo-500" />
            Security & Role Boundaries
          </h2>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start">
              <ArrowRight className="w-4 h-4 text-gray-400 mt-1 mr-2 flex-shrink-0" />
              <span><strong>Operator (User):</strong> Can view their assigned branch's dashboard, execute sales, request returns/exchanges, and view operator reports.</span>
            </li>
            <li className="flex items-start">
              <ArrowRight className="w-4 h-4 text-gray-400 mt-1 mr-2 flex-shrink-0" />
              <span><strong>Manager:</strong> Can view their assigned branch's analytics (Atlas Dashboard), approve/reject returns for their branch, and access operator tools.</span>
            </li>
            <li className="flex items-start">
              <ArrowRight className="w-4 h-4 text-gray-400 mt-1 mr-2 flex-shrink-0" />
              <span><strong>Administrator:</strong> Unrestricted access across all branches. Can create users, assign branches, run global reports, and manage all approvals.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Architecture */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
          <Database className="w-5 h-5 mr-2 text-indigo-500" />
          System Architecture
        </h2>
        
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 py-8 border-y border-gray-50">
          <div className="text-center">
            <div className="bg-blue-50 text-blue-700 px-6 py-4 rounded-lg font-medium border border-blue-100 shadow-sm">
              React + Vite (Frontend)
            </div>
            <p className="text-xs text-gray-500 mt-2">REST API</p>
          </div>
          
          <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 md:rotate-0" />
          
          <div className="text-center">
            <div className="bg-purple-50 text-purple-700 px-6 py-4 rounded-lg font-medium border border-purple-100 shadow-sm">
              FastAPI (Backend)
            </div>
            <p className="text-xs text-gray-500 mt-2">Auth & SAP Facade</p>
          </div>
          
          <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 md:rotate-0" />
          
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <div className="bg-orange-50 text-orange-700 px-6 py-3 rounded-lg font-medium border border-orange-100 shadow-sm">
                SAP Business One
              </div>
              <p className="text-xs text-gray-500 mt-2">Operational Data</p>
            </div>
            <div className="text-center">
              <div className="bg-green-50 text-green-700 px-6 py-3 rounded-lg font-medium border border-green-100 shadow-sm">
                PostgreSQL
              </div>
              <p className="text-xs text-gray-500 mt-2">Users & Workflow</p>
            </div>
          </div>
        </div>
      </div>

      {/* Implementation Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Current Implementation Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span><strong>Authentication:</strong> Fully implemented (JWT, PostgreSQL).</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span><strong>POS & Checkout:</strong> Integrated with SAP Service Layer.</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span><strong>Approvals & Returns:</strong> Multi-step exchange & credit notes.</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span><strong>Admin Dashboard:</strong> Aggregates SAP invoices and credit notes.</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
            <span><strong>Atlas Dashboard:</strong> Currently in progress (Analytics).</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Project;

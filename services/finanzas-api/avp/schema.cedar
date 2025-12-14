{
  "finanzassd": {
    "entityTypes": {
      "User": {
        "shape": {
          "type": "Record",
          "attributes": {}
        },
        "memberOfTypes": [
          "UserGroup"
        ]
      },
      "UserGroup": {
        "shape": {
          "type": "Record",
          "attributes": {}
        }
      },
      "Application": {
        "shape": {
          "type": "Record",
          "attributes": {}
        }
      }
    },
    "actions": {
      "get /adjustments": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /adjustments": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /alerts": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /allocation-rules": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /catalog/rubros": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /health": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /prefacturas/webhook": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /prefacturas/webhook": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /projects": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects/{id}/plan": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects/{id}/rubros": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /projects/{id}/rubros": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /providers": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /providers": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /close-month": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /payroll/ingest": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /projects/{id}/handoff": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "put /projects/{id}/allocations:bulk": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "delete /projects/{projectId}/rubros/{rubroId}": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /baseline/{baseline_id}": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /baseline": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /plan/forecast": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /prefacturas": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /prefacturas": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects/{projectId}/billing": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects/{projectId}/handoff": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /projects/{projectId}/handoff": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects/{projectId}/rubros": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /projects/{projectId}/rubros": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "post /uploads/docs": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "put /handoff/{handoffId}": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects/{projectId}/invoices": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "get /projects/{projectId}/invoices/{invoiceId}": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },
      "put /projects/{projectId}/invoices/{invoiceId}/status": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },

      "get /hub": {
        "appliesTo": {
          "principalTypes": [
            "User"
          ],
          "resourceTypes": [
            "Application"
          ],
          "context": {
            "type": "Record",
            "attributes": {}
          }
        },
        "memberOf": [
          {
            "id": "FIN",
            "type": "finanzassd::Action"
          }
        ]
      },

      "FIN": {
        "memberOf": [],
        "appliesTo": {
          "context": {
            "type": "Record",
            "attributes": {}
          },
          "principalTypes": [],
          "resourceTypes": []
        }
      }
    }
  }
}
